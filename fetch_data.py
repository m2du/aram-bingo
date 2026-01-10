#!/usr/bin/env python3

import json
import shutil
import tarfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from tqdm import tqdm


PROJECT_ROOT = Path(__file__).resolve().parent
CACHE_DIR = PROJECT_ROOT / "cache"
DATA_DIR = PROJECT_ROOT / "data"


def log(msg: str):
    print(f"[INFO] {msg}")


# -------------------------
# Safe tar extraction helpers
# -------------------------
def is_within_directory(directory: Path, target: Path) -> bool:
    directory = directory.resolve()
    target = target.resolve()
    return directory == target or directory in target.parents


# -------------------------
# Step 1
# -------------------------
def fetch_version():
    log("Fetching latest DDragon version list...")
    url = "https://ddragon.leagueoflegends.com/api/versions.json"

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    versions = response.json()
    if not versions:
        raise RuntimeError("No versions returned from API")

    version = versions[0]
    (PROJECT_ROOT / "version.txt").write_text(version, encoding="utf-8")

    log(f"Latest version '{version}' written to version.txt\n")
    return version


# -------------------------
# Step 2
# -------------------------
def download_dragontail(version: str):
    log("Downloading dragontail archive (if needed)...")

    archive_path = PROJECT_ROOT / f"dragontail-{version}.tgz"
    if archive_path.exists():
        log("Archive already exists, skipping download\n")
        return archive_path

    url = f"https://ddragon.leagueoflegends.com/cdn/dragontail-{version}.tgz"

    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        total = int(r.headers.get("Content-Length", 0))

        with open(archive_path, "wb") as f, tqdm(
            total=total,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc="Downloading"
        ) as bar:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))

    log(f"Downloaded to {archive_path}\n")
    return archive_path


# -------------------------
# Step 3
# -------------------------
def extract_archive(archive_path: Path, version: str):
    log("Extracting dragontail archive (if needed)...")

    extract_dir = CACHE_DIR / version
    marker = extract_dir / version / "data"

    if marker.exists():
        log("Extraction already exists, skipping extraction\n")
        return extract_dir, False

    extract_dir.mkdir(parents=True, exist_ok=True)

    with tarfile.open(archive_path, "r:gz") as tar:
        members = tar.getmembers()
        with tqdm(total=len(members), desc="Extracting", unit="files") as bar:
            for member in members:
                target_path = extract_dir / member.name
                if not is_within_directory(extract_dir, target_path):
                    raise RuntimeError(
                        f"Blocked path traversal attempt: {member.name}"
                    )
                tar.extract(member, extract_dir)
                bar.update(1)

    log(f"Extracted to {extract_dir}")
    return extract_dir, True


# -------------------------
# Step 4
# -------------------------
def generate_champions_json(version: str):
    log("Generating trimmed champions.json...")

    champion_file = (
        CACHE_DIR / version / version / "data" / "en_US" / "champion.json"
    )

    if not champion_file.exists():
        raise FileNotFoundError(f"champion.json not found at {champion_file}")

    with open(champion_file, "r", encoding="utf-8") as f:
        champion_data = json.load(f)

    trimmed = {
        key: value.get("name")
        for key, value in champion_data.get("data", {}).items()
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    output_file = DATA_DIR / "champions.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(trimmed, f, indent=2, ensure_ascii=False)

    log(f"champions.json written to {output_file}\n")


# -------------------------
# Step 5
# -------------------------
def copy_champion_images(version: str):
    log("Copying champion images...")

    src_dir = CACHE_DIR / version / version / "img" / "champion"
    dest_dir = DATA_DIR / "tiles"
    dest_dir.mkdir(parents=True, exist_ok=True)

    if not src_dir.exists():
        raise FileNotFoundError(f"Champion image directory not found: {src_dir}")

    files = [f for f in src_dir.iterdir() if f.is_file()]

    def copy_file(src: Path):
        shutil.copy2(src, dest_dir / src.name)

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(copy_file, f) for f in files]
        for _ in tqdm(
            as_completed(futures),
            total=len(futures),
            desc="Copying images",
            unit="files"
        ):
            pass

    log(f"Images copied to {dest_dir}\n")


# -------------------------
# Main
# -------------------------
def main():
    log("Starting DDragon data pipeline")

    version = fetch_version()
    archive = download_dragontail(version)
    _, extracted = extract_archive(archive, version)
    if extracted:
        log("Cleaning up archive file...")
        archive.unlink(missing_ok=True)
        
    generate_champions_json(version)
    copy_champion_images(version)

    log("All steps completed successfully")


if __name__ == "__main__":
    main()
