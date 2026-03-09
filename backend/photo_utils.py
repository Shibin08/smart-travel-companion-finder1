"""Photo utilities for user profile images."""

from pathlib import Path

# Get the backend directory
BACKEND_DIR = Path(__file__).parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
DEFAULT_PHOTO_PATH = "/uploads/default-avatar.svg"


def get_default_photo(gender: str = "Other") -> str:
    """Return a neutral default avatar path for all users."""
    return DEFAULT_PHOTO_PATH


def save_photo_file(file_content: bytes, user_id: str, file_ext: str = "jpg") -> str:
    """
    Save uploaded photo to backend/uploads directory and return a reference path.
    
    Args:
        file_content: Binary file content
        user_id: User ID for organizing uploads
        file_ext: File extension (jpg, png, etc.)
    
    Returns:
        File path reference for storage in database (e.g., /uploads/user_id/profile_123456.jpg)
    """
    # Ensure uploads directory exists
    UPLOADS_DIR.mkdir(exist_ok=True)
    
    # Create user-specific directory
    user_upload_dir = UPLOADS_DIR / user_id
    user_upload_dir.mkdir(exist_ok=True)
    
    # Save file with timestamp
    import time
    filename = f"profile_{int(time.time())}.{file_ext}"
    file_path = user_upload_dir / filename
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return relative web path
    return f"/uploads/{user_id}/{filename}"


def delete_old_photo(photo_url: str) -> None:
    """
    Delete old photo file if it exists and is a local file.
    """
    if (
        not photo_url
        or photo_url.startswith("http")
        or photo_url == DEFAULT_PHOTO_PATH
    ):
        return  # Don't delete external URLs (Unsplash, etc.)
    
    try:
        file_path = UPLOADS_DIR.parent / photo_url.lstrip("/")
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        print(f"Error deleting photo: {e}")


def is_local_photo(photo_url: str) -> bool:
    """Check if photo is a local file (not an external URL)."""
    return photo_url and not photo_url.startswith("http")

