from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "OpenClaw Control Plane API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    database_url: str = "sqlite:///./control_plane.db"
    cors_origins: str = "*"
    api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
