"""Demo mode auth bypass — no login required for hackathon submission."""


class DemoUser:
    id = 1
    username = "demo"
    role = "admin"


def require_role(required_role: str):
    def dependency() -> DemoUser:
        return DemoUser()

    return dependency
