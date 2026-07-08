from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0007_step_django_groups'),
    ]

    operations = [
        migrations.AddField(
            model_name='workflowdefinition',
            name='code_prefix',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='request',
            name='code',
            field=models.CharField(blank=True, db_index=True, default='', max_length=60),
        ),
    ]
