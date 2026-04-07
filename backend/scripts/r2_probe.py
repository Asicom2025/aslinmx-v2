"""
Probe simple para validar conectividad y permisos contra Cloudflare R2.

Uso:
    python scripts/r2_probe.py
    python scripts/r2_probe.py --force-root-endpoint
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from uuid import uuid4

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


def build_client(force_root_endpoint: bool = False):
    account_id = os.environ.get("R2_ACCOUNT_ID")
    bucket = os.environ.get("R2_BUCKET_NAME")
    endpoint = os.environ.get("R2_ENDPOINT_URL")

    if force_root_endpoint and account_id:
        endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    elif not endpoint and account_id:
        endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

    return (
        boto3.session.Session().client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
            region_name="auto",
            config=Config(signature_version="s3v4"),
        ),
        endpoint,
        bucket,
    )


def call(name: str, fn):
    try:
        result = fn()
        meta = result.get("ResponseMetadata", {}) if isinstance(result, dict) else {}
        print(
            f"{name}: OK status={meta.get('HTTPStatusCode')} request_id={meta.get('RequestId')}"
        )
        return True
    except ClientError as exc:
        error = exc.response.get("Error", {})
        meta = exc.response.get("ResponseMetadata", {})
        print(
            f"{name}: ERROR code={error.get('Code')} "
            f"message={error.get('Message')} "
            f"status={meta.get('HTTPStatusCode')} "
            f"request_id={meta.get('RequestId')}"
        )
        return False
    except Exception as exc:
        print(f"{name}: ERROR type={type(exc).__name__} message={exc}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force-root-endpoint",
        action="store_true",
        help="Ignora R2_ENDPOINT_URL y usa https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Imprime la respuesta cruda de botocore cuando Cloudflare devuelve error.",
    )
    args = parser.parse_args()

    client, endpoint, bucket = build_client(force_root_endpoint=args.force_root_endpoint)
    probe_key = f"debug/codex-r2-probe-{uuid4().hex}.txt"

    print("endpoint:", endpoint)
    print("bucket:", bucket)
    print("access_key_id_prefix:", (os.environ.get("R2_ACCESS_KEY_ID") or "")[:6] + "***")

    ok = True
    operations = [
        ("head_bucket", lambda: client.head_bucket(Bucket=bucket)),
        ("list_objects_v2", lambda: client.list_objects_v2(Bucket=bucket, MaxKeys=1)),
        (
            "put_object",
            lambda: client.put_object(
                Bucket=bucket,
                Key=probe_key,
                Body=b"probe",
                ContentType="text/plain",
            ),
        ),
        ("delete_object", lambda: client.delete_object(Bucket=bucket, Key=probe_key)),
    ]

    for name, fn in operations:
        try:
            result = fn()
            meta = result.get("ResponseMetadata", {}) if isinstance(result, dict) else {}
            print(
                f"{name}: OK status={meta.get('HTTPStatusCode')} request_id={meta.get('RequestId')}"
            )
        except ClientError as exc:
            error = exc.response.get("Error", {})
            meta = exc.response.get("ResponseMetadata", {})
            headers = meta.get("HTTPHeaders", {}) or {}
            print(
                f"{name}: ERROR code={error.get('Code')} "
                f"message={error.get('Message')} "
                f"status={meta.get('HTTPStatusCode')} "
                f"request_id={meta.get('RequestId')} "
                f"cf_ray={headers.get('cf-ray')} "
                f"server={headers.get('server')}"
            )
            if args.verbose:
                print(json.dumps(exc.response, indent=2, default=str))
            ok = False
        except Exception as exc:
            print(f"{name}: ERROR type={type(exc).__name__} message={exc}")
            ok = False

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
