"""
Add unique constraint to Request.code.
RunPython resolves any pre-existing duplicates (renames the newer ones)
before the constraint is applied so the migration never fails mid-run.
Reverse: removes the unique constraint; renamed codes are NOT restored
(data-fix reversals are impractical and not needed for rollback safety).
"""
from django.db import migrations, models


def fix_duplicate_codes(apps, schema_editor):
    """Keep the oldest code; suffix newer duplicates with -DUP<n>."""
    Request = apps.get_model('workflows', 'Request')
    seen = {}
    for req in Request.objects.exclude(code='').order_by('created_at'):
        if req.code in seen:
            seen[req.code] += 1
            req.code = f"{req.code}-DUP{seen[req.code]}"
            req.save(update_fields=['code'])
        else:
            seen[req.code] = 0


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0008_request_code_workflow_code_prefix'),
    ]

    operations = [
        migrations.RunPython(fix_duplicate_codes, reverse_code=noop),
        migrations.AlterField(
            model_name='request',
            name='code',
            field=models.CharField(blank=True, max_length=60, unique=True),
        ),
    ]
