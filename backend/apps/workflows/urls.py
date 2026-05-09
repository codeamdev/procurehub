from django.urls import path, include
from rest_framework_nested import routers
from .views import (
    WorkflowDefinitionViewSet,
    StepViewSet,
    FieldViewSet,
    FieldRuleViewSet,
    BranchViewSet,
    WorkflowConditionViewSet,
    BranchConditionRouteViewSet,
    RequestViewSet,
)

# Root router
router = routers.DefaultRouter()
router.register(r'definitions', WorkflowDefinitionViewSet, basename='workflow-definition')
router.register(r'requests', RequestViewSet, basename='workflow-request')

# Nested: /definitions/{workflow_pk}/steps/
# Nested: /definitions/{workflow_pk}/fields/
# Nested: /definitions/{workflow_pk}/conditions/
definitions_router = routers.NestedDefaultRouter(router, r'definitions', lookup='workflow')
definitions_router.register(r'steps', StepViewSet, basename='workflow-step')
definitions_router.register(r'fields', FieldViewSet, basename='workflow-field')
definitions_router.register(r'conditions', WorkflowConditionViewSet, basename='workflow-condition')

# Nested: /definitions/{workflow_pk}/steps/{step_pk}/field-rules/
# Nested: /definitions/{workflow_pk}/steps/{step_pk}/branches/
steps_router = routers.NestedDefaultRouter(definitions_router, r'steps', lookup='step')
steps_router.register(r'field-rules', FieldRuleViewSet, basename='step-fieldrule')
steps_router.register(r'branches', BranchViewSet, basename='step-branch')

# Nested: /definitions/{workflow_pk}/steps/{step_pk}/branches/{branch_pk}/routes/
branches_router = routers.NestedDefaultRouter(steps_router, r'branches', lookup='branch')
branches_router.register(r'routes', BranchConditionRouteViewSet, basename='branch-route')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(definitions_router.urls)),
    path('', include(steps_router.urls)),
    path('', include(branches_router.urls)),
]
