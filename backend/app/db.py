from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


def make_engine(url: str = DATABASE_URL):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def init_db(bind=engine) -> None:
    from app import models  # noqa: F401  (registers tables)

    Base.metadata.create_all(bind)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
