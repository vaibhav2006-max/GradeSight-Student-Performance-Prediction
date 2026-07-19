import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    # Default: SQLite so the project runs out of the box with zero setup.
    # To use MySQL instead, set the DATABASE_URL env var, e.g.:
    #   mysql+pymysql://root:password@localhost:3306/student_performance
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'student_performance.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 8  # 8 hours

    MODEL_DIR = os.path.join(BASE_DIR, "..", "model")
    DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
