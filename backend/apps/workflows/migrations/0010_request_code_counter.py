from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0009_request_code_unique'),
    ]

    operations = [
        migrations.CreateModel(
            name='RequestCodeCounter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('family_id', models.UUIDField()),
                ('year', models.PositiveIntegerField()),
                ('last_seq', models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.AddConstraint(
            model_name='requestcodecounter',
            constraint=models.UniqueConstraint(
                fields=['family_id', 'year'],
                name='unique_code_counter_family_year',
            ),
        ),
    ]
