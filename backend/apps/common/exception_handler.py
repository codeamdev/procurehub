import logging
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from .exceptions import AppError

logger = logging.getLogger(__name__)


def app_exception_handler(exc, context):
    """
    Converts domain AppErrors and DRF exceptions into a consistent envelope:
      {"error": "<human message>", "code": "<machine code>"}
    Field-level DRF ValidationErrors keep their native format under "errors".
    """
    if isinstance(exc, AppError):
        logger.warning(
            '%s raised in %s: %s',
            exc.__class__.__name__,
            _view_name(context),
            exc.detail,
        )
        return Response({'error': exc.detail, 'code': exc.code}, status=exc.status_code)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict) and 'detail' in data and len(data) == 1:
        # Single-detail DRF errors → normalize
        response.data = {
            'error': str(data['detail']),
            'code': getattr(data['detail'], 'code', 'error'),
        }
    elif isinstance(data, dict) and 'detail' not in data:
        # Field-level validation errors → wrap under "errors"
        response.data = {'errors': data, 'code': 'validation_error'}

    return response


def _view_name(context) -> str:
    view = context.get('view')
    return type(view).__name__ if view else 'unknown'
