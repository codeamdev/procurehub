class AppError(Exception):
    """Base domain exception. Raised by services; caught by the exception handler."""
    status_code: int = 400
    default_code: str = 'error'

    def __init__(self, detail: str = None, code: str = None):
        self.detail = detail or 'An error occurred.'
        self.code = code or self.default_code
        super().__init__(self.detail)


class NotFoundError(AppError):
    status_code = 404
    default_code = 'not_found'


class ConflictError(AppError):
    status_code = 409
    default_code = 'conflict'


class PermissionDeniedError(AppError):
    status_code = 403
    default_code = 'permission_denied'
