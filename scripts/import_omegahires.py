#!/usr/bin/env python3
"""Import the issued OmegaHires invoices into Horizon through its HTTP APIs.

Credentials come from the environment and are never printed:
  HORIZON_API_BASE     default http://127.0.0.1:9001
  HORIZON_EMAIL        account used to sign in
  HORIZON_PASSWORD
  HORIZON_OWNER_EMAIL  organization owner; defaults to HORIZON_EMAIL

Creating the organization uses POST /api/platform/organizations, which requires
platform access. The owner is an existing Horizon user. Tenant calls send the
organization slug. If OMEGAHIRES already exists, the script keeps that
organization and continues only while OH/26-27/0001 is absent. Once that invoice
exists, a later run stops before creating another client, invoice, or employee.

Bank details stay in the fixture and are sent only as the invoice template's
payment block. They are not written to stdout.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "omegahires.json"
CENT = Decimal("0.01")
HUNDRED = Decimal("100")
STOP_INVOICE = "OH/26-27/0001"


class ImportError(RuntimeError):
    pass


def money(value) -> Decimal:
    if isinstance(value, str):
        return Decimal(value).quantize(CENT)
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def tax_of(subtotal: Decimal, rate: Decimal) -> Decimal:
    return (subtotal * rate / HUNDRED).quantize(CENT, rounding=ROUND_HALF_UP)


def check_fixture(data: dict) -> None:
    seen = set()
    for invoice in data["invoices"]:
        number = invoice["invoiceNumber"]
        if number in seen:
            raise ImportError(f"Fixture repeats {number}")
        seen.add(number)
        subtotal = money(invoice["subtotal"])
        rate = money(invoice["taxRate"])
        tax = tax_of(subtotal, rate)
        total = (subtotal + tax).quantize(CENT)
        if tax != money(invoice["taxTotal"]) or total != money(invoice["total"]):
            raise ImportError(f"{number} fixture total does not match half-up GST on the taxable amount")
        if money(invoice["unitPrice"]) != subtotal or money(invoice["quantity"]) != Decimal("1.00"):
            raise ImportError(f"{number} line rate does not match the taxable amount")
        expected = [(line["label"], money(line["amount"])) for line in invoice["expectedTax"]]
        if tax == 0:
            if expected:
                raise ImportError(f"{number} zero-tax invoice should not expect a tax line")
        elif expected and expected[0][0] == "IGST":
            if expected != [("IGST", tax)]:
                raise ImportError(f"{number} expected IGST does not equal the tax total")
        else:
            central = (tax / 2).quantize(CENT, rounding=ROUND_HALF_UP)
            if expected != [("CGST", central), ("SGST", (tax - central).quantize(CENT))]:
                raise ImportError(f"{number} expected CGST/SGST does not match Horizon's half split")
    numbers = [invoice["invoiceNumber"] for invoice in data["invoices"]]
    if numbers != [f"OH/26-27/{index:04d}" for index in range(1, len(numbers) + 1)]:
        raise ImportError("Fixture invoices must be OH/26-27/0001 onward with no gaps")


def public_message(raw: str) -> str:
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return "request failed"
    if isinstance(body, dict):
        for key in ("detail", "message", "title", "error"):
            value = body.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()[:300]
    return "request failed"


class Horizon:
    def __init__(self, base: str, token: str):
        self.base = base.rstrip("/")
        self.token = token
        self.organization = None
        self.workspace = None

    def call(self, method: str, path: str, body=None, idempotency: str | None = None, tolerate=()):
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/json"}
        if self.organization:
            headers["X-Lexorion-Organization"] = self.organization
        if self.workspace:
            headers["X-Lexorion-Workspace"] = self.workspace
        if idempotency:
            headers["Idempotency-Key"] = idempotency
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8", "replace")
            if error.code in tolerate:
                return error.code, None
            raise ImportError(f"{method} {path} returned {error.code}: {public_message(raw)}") from None


def login(base: str, email: str, password: str) -> str:
    payload = json.dumps({"email": email, "password": password}).encode()
    request = urllib.request.Request(
        base.rstrip("/") + "/api/platform/auth/login",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            token = json.loads(response.read()).get("accessToken")
    except urllib.error.HTTPError as error:
        raise ImportError(f"Sign-in failed with status {error.code}") from None
    if not token:
        raise ImportError("Sign-in did not return an access token")
    return token


def existing_organization(api: Horizon):
    status, listed = api.call("GET", "/api/platform/organizations", tolerate=(401, 403))
    if status == 200:
        for org in listed or []:
            if org.get("organizationCode") == "OMEGAHIRES" or org.get("slug") == "omegahires":
                return org.get("organizationCode") or org.get("slug")
    status, mine = api.call("GET", "/api/platform/me/organizations", tolerate=(401, 403))
    if status == 200:
        for org in mine or []:
            if org.get("slug") == "omegahires" or org.get("organizationName") == "OmegaHires":
                return org.get("slug")
    return None


def invoice_already_issued(api: Horizon) -> bool:
    status, page = api.call(
        "GET",
        "/api/finance/invoices?" + urllib.parse.urlencode({"search": STOP_INVOICE, "size": 20}),
        tolerate=(401, 403, 404),
    )
    if status != 200 or not page:
        return False
    return any(row.get("invoiceNumber") == STOP_INVOICE for row in page.get("content", []))


def owner_id(api: Horizon, owner_email: str) -> str:
    status, me = api.call("GET", "/api/platform/me")
    if status == 200 and me.get("email", "").lower() == owner_email.lower():
        return me["id"]
    status, users = api.call("GET", "/api/platform/users", tolerate=(401, 403))
    if status == 200:
        for user in users or []:
            if user.get("email", "").lower() == owner_email.lower():
                return user["id"]
    raise ImportError("The owner email is not an existing Horizon user visible to this sign-in")


def template_config(data: dict, signatory: str, gstin: str, pan: str) -> dict:
    seller = data["seller"]
    return {
        "branding": {"primaryColor": "#1D2B7A", "accentColor": "#7CB342"},
        "seller": {
            "legalName": seller["legalName"],
            "tagline": seller["tagline"],
            "subline": seller["subline"],
            "address": seller["address"],
            "phone": seller["phone"],
            "email": seller["email"],
            "website": seller["website"],
            "region": seller["region"],
            "identifiers": [
                {"label": "GSTIN", "value": gstin},
                {"label": "PAN", "value": pan},
                {"label": "CIN", "value": seller["cin"]},
                {"label": "TAN", "value": seller["tan"]},
            ],
        },
        "document": {
            "title": "TAX INVOICE",
            "subtitle": None,
            "copyLabel": "ORIGINAL FOR RECIPIENT",
            "detailsTitle": "RECRUITMENT ENGAGEMENT",
        },
        "numbering": {"pattern": "OH/{FY}/{SEQ}", "padding": 4, "fiscalYearStartMonth": 4},
        "tax": {"mode": "GST", "label": "GST"},
        "columns": {"showItemCode": True, "itemCodeLabel": "CODE", "showHsnSac": True},
        "customFields": [
            {"key": "candidate", "label": "Candidate", "type": "TEXT", "required": False},
            {"key": "position", "label": "Position / role", "type": "TEXT", "required": False},
            {"key": "joiningDate", "label": "Joining date", "type": "DATE", "required": False},
            {"key": "poReference", "label": "PO reference", "type": "TEXT", "required": False},
        ],
        "paymentDetails": seller["paymentDetails"],
        "terms": seller["terms"],
        "defaultNotes": seller["defaultNotes"],
        "signatory": {"name": signatory, "title": "Authorised signatory"},
        "footerNote": seller["footerNote"],
        "showAmountInWords": True,
        "dateStyle": "ORDINAL",
    }


def ensure_workspace(api: Horizon, workspace: dict) -> None:
    status, rows = api.call("GET", "/api/tenant/workspaces")
    if status == 200 and any(row.get("key") == workspace["key"] for row in rows or []):
        return
    api.call("POST", "/api/tenant/workspaces", {
        "key": workspace["key"],
        "displayName": workspace["displayName"],
        "productKey": workspace["productKey"],
        "productKeys": workspace["productKeys"],
    })


def ensure_reference(api: Horizon, path: str, key: str, body: dict) -> None:
    status, rows = api.call("GET", path)
    if status == 200 and any(row.get("key") == key for row in rows or []):
        return
    api.call("POST", path, body)


def import_all(api: Horizon, data: dict, resume: bool) -> None:
    org = data["organization"]
    if not resume:
        api.call("POST", "/api/platform/organizations", {
            "name": org["name"],
            "legalName": org["legalName"],
            "organizationCode": org["organizationCode"],
            "slug": org["slug"],
            "primaryEmail": org["primaryEmail"],
            "primaryPhone": org["primaryPhone"],
            "ownerUserId": api.owner_id,
            "planKey": org["planKey"],
            "status": org["status"],
        })
    api.organization = org["slug"]
    api.call("PATCH", "/api/tenant/organization/settings", org["settings"])
    api.call("PATCH", "/api/tenant/organization", org["profile"])
    workspace = data["workspace"]
    ensure_workspace(api, workspace)
    api.workspace = workspace["key"]
    if invoice_already_issued(api):
        print(f"Stopped: {STOP_INVOICE} already exists. No further clients, invoices, or employees were created.")
        return

    for item in data["items"]:
        api.call("POST", "/api/finance/items", item)
    first = data["invoices"][0]
    signatory = first["signatoryName"]
    gstin, pan = first["sellerGstin"], first["sellerPan"]
    api.call("POST", "/api/finance/templates", {
        "templateKey": "recruitment",
        "name": "Recruitment tax invoice",
        "layout": "MODERN",
        "makeDefault": True,
        "config": template_config(data, signatory, gstin, pan),
    })
    for client in data["clients"]:
        api.call("POST", "/api/finance/clients", client)

    verified = []
    for invoice in data["invoices"]:
        if invoice["signatoryName"] != signatory or invoice["sellerGstin"] != gstin or invoice["sellerPan"] != pan:
            signatory, gstin, pan = invoice["signatoryName"], invoice["sellerGstin"], invoice["sellerPan"]
            api.call("PUT", "/api/finance/templates/recruitment", {
                "config": template_config(data, signatory, gstin, pan),
            })
        line = {
            "itemCode": invoice["itemCode"],
            "description": invoice["description"],
            "quantity": invoice["quantity"],
            "unitPrice": invoice["unitPrice"],
            "taxRate": invoice["taxRate"],
        }
        if invoice.get("hsnSac"):
            line["hsnSac"] = invoice["hsnSac"]
        draft = api.call("POST", "/api/finance/invoices", {
            "clientKey": invoice["clientKey"],
            "templateKey": "recruitment",
            "issueDate": invoice["issueDate"],
            "dueDate": invoice["dueDate"],
            "placeOfSupply": invoice["placeOfSupply"],
            "notes": data["seller"]["defaultNotes"],
            "customFields": invoice["customFields"],
            "lines": [line],
        })[1]
        issued = api.call(
            "POST",
            f"/api/finance/invoices/{urllib.parse.quote(draft['reference'])}/issue",
            idempotency=f"omegahires-issue-{invoice['invoiceNumber'].replace('/', '-')}",
        )[1]
        verified.append(compare(invoice, issued))

    for department in data["departments"]:
        ensure_reference(api, "/api/workforce/departments", department["key"], department)
    for designation in data["designations"]:
        ensure_reference(api, "/api/workforce/designations", designation["key"], designation)
    employees = 0
    for employee in data["employees"]:
        code = urllib.parse.quote(employee["employeeCode"])
        status, _ = api.call("GET", f"/api/workforce/employees/{code}", tolerate=(404,))
        if status == 404:
            api.call("POST", "/api/workforce/employees", employee)
        employees += 1
    payroll = data.get("payroll")
    if payroll:
        component = payroll["component"]
        status, components = api.call("GET", "/api/payroll/components")
        if status == 200 and not any(row.get("componentKey") == component["componentKey"] for row in components or []):
            api.call("POST", "/api/payroll/components", component)
        for employee in data["employees"]:
            code = urllib.parse.quote(employee["employeeCode"])
            status, _ = api.call("GET", f"/api/payroll/employees/{code}", tolerate=(404,))
            if status == 404:
                api.call("POST", "/api/payroll/employees", {
                    "employeeCode": employee["employeeCode"],
                    "status": "ACTIVE",
                    "currency": "INR",
                    "payFrequency": "MONTHLY",
                    "effectiveFrom": employee["joiningDate"],
                })
            api.call("POST", f"/api/payroll/employees/{code}/compensation", {
                "profileKey": "default",
                "currency": "INR",
                "effectiveFrom": employee["joiningDate"],
                "status": "ACTIVE",
                "components": [{
                    "componentKey": component["componentKey"],
                    "value": payroll["monthlyAmount"],
                }],
            })

    print(f"organization {org['organizationCode']} workspace {workspace['key']}")
    print(f"clients {len(data['clients'])} invoices {len(verified)} employees {employees} receipts 0")
    for row in verified:
        print(row)


def compare(expected: dict, issued: dict) -> str:
    number = issued.get("invoiceNumber")
    if number != expected["invoiceNumber"]:
        raise ImportError(f"Issued number {number} did not match {expected['invoiceNumber']}")
    pairs = (
        ("subtotal", issued.get("subtotal"), expected["subtotal"]),
        ("tax", issued.get("taxTotal"), expected["taxTotal"]),
        ("total", issued.get("total"), expected["total"]),
        ("balance", issued.get("balanceDue"), expected["total"]),
    )
    for label, actual, target in pairs:
        if money(actual) != money(target):
            raise ImportError(f"{number} {label} {actual} did not match {target}")
    actual_tax = [(line["label"], money(line["amount"])) for line in issued.get("taxBreakdown") or []]
    expected_tax = [(line["label"], money(line["amount"])) for line in expected["expectedTax"]]
    if actual_tax != expected_tax:
        raise ImportError(f"{number} tax lines {actual_tax} did not match the Horizon expectation {expected_tax}")
    pdf_tax = [(line["label"], money(line["amount"])) for line in expected["pdfTax"]]
    note = ""
    if pdf_tax != expected_tax:
        note = " pdf tax differs; grand total matches"
    if issued.get("status") != "ISSUED" or money(issued.get("amountPaid")) != Decimal("0.00"):
        raise ImportError(f"{number} was not issued unpaid")
    return f"{number} subtotal {expected['subtotal']} tax {expected['taxTotal']} total {expected['total']} unpaid{note}"


def main() -> int:
    data = json.loads(FIXTURE.read_text())
    check_fixture(data)
    email = os.environ.get("HORIZON_EMAIL", "").strip()
    password = os.environ.get("HORIZON_PASSWORD", "")
    if not email or not password:
        print("Set HORIZON_EMAIL and HORIZON_PASSWORD. The password is not read from the fixture.", file=sys.stderr)
        return 2
    base = os.environ.get("HORIZON_API_BASE", "http://127.0.0.1:9001").strip()
    try:
        api = Horizon(base, login(base, email, password))
        found = existing_organization(api)
        api.owner_id = owner_id(api, os.environ.get("HORIZON_OWNER_EMAIL", email).strip())
        import_all(api, data, resume=found is not None)
    except (ImportError, urllib.error.URLError, TimeoutError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
