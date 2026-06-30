#!/usr/bin/env python3
"""End-to-end App Store Connect submission driver for Polskie Ślady Taszkent.

Subcommands (run in order, or `all`):
  status        - print current state of app/version/build/localizations
  metadata      - version attrs, attach build, export compliance, categories, localizations
  screenshots   - upload 6.9" screenshots to the primary (pl) localization
  agerating     - set age rating declaration to 4+ (all NONE)
  privacy       - declare App Privacy = Data Not Collected and publish
  review        - set App Review contact info (no demo account)
  submit        - create the review submission (THE actual submit to Apple)
  all           - metadata + screenshots + agerating + privacy + review (NOT submit)

`submit` is intentionally separate so nothing is sent to Apple until explicitly asked.
"""
import base64, hashlib, json, os, sys, glob
import urllib.request, urllib.error
from asc import request, make_jwt, BASE  # reuse JWT signer + HTTP helper

import metadata as M

APP_ID = "6782352124"
BUNDLE_ID = "com.github.polskiesladytaszkent"
VERSION_STRING = "1.1.2"
PRIMARY_LOCALE = "pl"
SCREENSHOT_DISPLAY_TYPE = "APP_IPHONE_67"  # 6.9"/6.7" iPhone set (accepts 1320x2868)
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "ios-6.9")
SCREENSHOT_FILES = ["01.png", "02.png", "03.png", "04.png"]

PRIMARY_CATEGORY = "REFERENCE"
SECONDARY_CATEGORY = "EDUCATION"

REVIEW_CONTACT = {
    "contactFirstName": "Eduard",
    "contactLastName": "Yelenskiy",
    "contactPhone": "+998200004856",
    "contactEmail": "eduardyelenskiy@gmail.com",
    "demoAccountRequired": False,
    "demoAccountName": "",
    "demoAccountPassword": "",
    "notes": ("The app works fully offline. No sign-in or account is required. "
              "Location permission is optional and used only on-device to show the "
              "user's position on the map; no data is collected or transmitted."),
}

# ---------- helpers ----------

def call(method, path, body=None, ok=(200, 201, 204)):
    status, txt = request(method, path, body)
    if status not in ok:
        raise SystemExit(f"\n!! {method} {path} -> HTTP {status}\n{txt}\n")
    try:
        return status, (json.loads(txt) if txt.strip() else {})
    except Exception:
        return status, {}

def jget(path):
    return call("GET", path)[1]

def discover():
    d = {}
    v = jget(f"/v1/apps/{APP_ID}/appStoreVersions?filter[versionString]={VERSION_STRING}"
             f"&fields[appStoreVersions]=versionString,appStoreState&limit=10")
    vers = v.get("data", [])
    if not vers:
        # fall back to the single existing editable version
        v = jget(f"/v1/apps/{APP_ID}/appStoreVersions?limit=10")
        vers = v.get("data", [])
    editable = [x for x in vers if x["attributes"]["appStoreState"] in
                ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED")]
    d["version"] = (editable or vers)[0]
    d["version_id"] = d["version"]["id"]

    b = jget(f"/v1/builds?filter[app]={APP_ID}&filter[version]=1&limit=5"
             f"&fields[builds]=version,processingState")
    builds = [x for x in b.get("data", []) if x["attributes"]["processingState"] == "VALID"] or b.get("data", [])
    d["build_id"] = builds[0]["id"] if builds else None

    ai = jget(f"/v1/apps/{APP_ID}/appInfos?include=appInfoLocalizations,ageRatingDeclaration&limit=10")
    info = [x for x in ai["data"] if x["attributes"]["appStoreState"] in
            ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED")] or ai["data"]
    d["app_info_id"] = info[0]["id"]
    d["age_rating_id"] = info[0]["relationships"]["ageRatingDeclaration"]["data"]["id"]
    d["app_info_locs"] = {x["attributes"]["locale"]: x["id"]
                          for x in ai.get("included", []) if x["type"] == "appInfoLocalizations"}

    vl = jget(f"/v1/appStoreVersions/{d['version_id']}/appStoreVersionLocalizations?limit=50")
    d["version_locs"] = {x["attributes"]["locale"]: x["id"] for x in vl.get("data", [])}
    return d

# ---------- commands ----------

def cmd_status():
    d = discover()
    print(json.dumps({k: v for k, v in d.items() if k not in ("version",)}, indent=2, ensure_ascii=False))

def cmd_metadata():
    d = discover()
    vid = d["version_id"]
    print("• version attrs (versionString, copyright, releaseType=MANUAL)")
    call("PATCH", f"/v1/appStoreVersions/{vid}", {
        "data": {"type": "appStoreVersions", "id": vid, "attributes": {
            "versionString": VERSION_STRING, "copyright": M.COPYRIGHT, "releaseType": "MANUAL"}}})

    if d["build_id"]:
        print("• attach build", d["build_id"])
        call("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build",
             {"data": {"type": "builds", "id": d["build_id"]}})
        enc = jget(f"/v1/builds/{d['build_id']}?fields[builds]=usesNonExemptEncryption")
        if enc["data"]["attributes"]["usesNonExemptEncryption"] is None:
            print("• export compliance (usesNonExemptEncryption=false)")
            call("PATCH", f"/v1/builds/{d['build_id']}", {
                "data": {"type": "builds", "id": d["build_id"],
                         "attributes": {"usesNonExemptEncryption": False}}})
        else:
            print("• export compliance already set, skip")
    else:
        print("!! no VALID build found to attach")

    print(f"• categories primary={PRIMARY_CATEGORY} secondary={SECONDARY_CATEGORY}")
    call("PATCH", f"/v1/appInfos/{d['app_info_id']}", {
        "data": {"type": "appInfos", "id": d["app_info_id"], "relationships": {
            "primaryCategory": {"data": {"type": "appCategories", "id": PRIMARY_CATEGORY}},
            "secondaryCategory": {"data": {"type": "appCategories", "id": SECONDARY_CATEGORY}}}}})

    # App info localizations (name, subtitle, privacy url)
    for locale, fields in M.APP_INFO.items():
        attrs = {"name": fields["name"], "subtitle": fields["subtitle"],
                 "privacyPolicyUrl": M.PRIVACY_URL}
        if locale in d["app_info_locs"]:
            lid = d["app_info_locs"][locale]
            print(f"• update appInfoLoc {locale}")
            call("PATCH", f"/v1/appInfoLocalizations/{lid}",
                 {"data": {"type": "appInfoLocalizations", "id": lid, "attributes": attrs}})
        else:
            print(f"• create appInfoLoc {locale}")
            body = {"data": {"type": "appInfoLocalizations",
                             "attributes": {**attrs, "locale": locale},
                             "relationships": {"appInfo": {"data": {"type": "appInfos", "id": d["app_info_id"]}}}}}
            call("POST", "/v1/appInfoLocalizations", body)

    # Version localizations (description, keywords, urls, promo, whatsNew)
    for locale, f in M.VERSION_LOC.items():
        # whatsNew is only editable for updates, not the first version -> omit it.
        attrs = {"description": f["description"], "keywords": f["keywords"],
                 "promotionalText": f["promotionalText"],
                 "supportUrl": M.SUPPORT_URL, "marketingUrl": M.MARKETING_URL}
        if locale in d["version_locs"]:
            lid = d["version_locs"][locale]
            print(f"• update versionLoc {locale}")
            call("PATCH", f"/v1/appStoreVersionLocalizations/{lid}",
                 {"data": {"type": "appStoreVersionLocalizations", "id": lid, "attributes": attrs}})
        else:
            print(f"• create versionLoc {locale}")
            body = {"data": {"type": "appStoreVersionLocalizations",
                             "attributes": {**attrs, "locale": locale},
                             "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}}
            call("POST", "/v1/appStoreVersionLocalizations", body)
    print("metadata done.")

def _raw_put(url, headers, payload):
    req = urllib.request.Request(url, data=payload, headers=headers, method="PUT")
    with urllib.request.urlopen(req) as r:
        return r.status

def cmd_screenshots():
    d = discover()
    loc_id = d["version_locs"].get(PRIMARY_LOCALE)
    if not loc_id:
        raise SystemExit("primary version localization not found; run metadata first")

    # reuse existing set for the display type if present, else create
    sets = jget(f"/v1/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")
    set_id = None
    for s in sets.get("data", []):
        if s["attributes"]["screenshotDisplayType"] == SCREENSHOT_DISPLAY_TYPE:
            set_id = s["id"]; break
    if not set_id:
        print("• create screenshot set", SCREENSHOT_DISPLAY_TYPE)
        _, r = call("POST", "/v1/appScreenshotSets", {
            "data": {"type": "appScreenshotSets",
                     "attributes": {"screenshotDisplayType": SCREENSHOT_DISPLAY_TYPE},
                     "relationships": {"appStoreVersionLocalization": {
                         "data": {"type": "appStoreVersionLocalizations", "id": loc_id}}}}})
        set_id = r["data"]["id"]
    else:
        print("• reuse screenshot set", set_id)

    existing = jget(f"/v1/appScreenshotSets/{set_id}/appScreenshots").get("data", [])
    have = {s["attributes"]["fileName"] for s in existing}

    for fn in SCREENSHOT_FILES:
        path = os.path.join(SCREENSHOT_DIR, fn)
        data = open(path, "rb").read()
        if fn in have:
            print(f"  - {fn} already uploaded, skip"); continue
        print(f"• reserve {fn} ({len(data)} bytes)")
        _, r = call("POST", "/v1/appScreenshots", {
            "data": {"type": "appScreenshots",
                     "attributes": {"fileName": fn, "fileSize": len(data)},
                     "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}})
        sid = r["data"]["id"]
        for op in r["data"]["attributes"]["uploadOperations"]:
            hdrs = {h["name"]: h["value"] for h in op["requestHeaders"]}
            chunk = data[op["offset"]: op["offset"] + op["length"]]
            print(f"  - PUT {op['length']}B @ {op['offset']}")
            _raw_put(op["url"], hdrs, chunk)
        md5 = hashlib.md5(data).hexdigest()
        print(f"  - commit {fn} md5={md5}")
        call("PATCH", f"/v1/appScreenshots/{sid}", {
            "data": {"type": "appScreenshots", "id": sid,
                     "attributes": {"uploaded": True, "sourceFileChecksum": md5}}})
    print("screenshots done.")

def cmd_agerating():
    d = discover()
    aid = d["age_rating_id"]
    attrs = {
        # content descriptors -> NONE
        "alcoholTobaccoOrDrugUseOrReferences": "NONE",
        "contests": "NONE",
        "gamblingSimulated": "NONE",
        "medicalOrTreatmentInformation": "NONE",
        "profanityOrCrudeHumor": "NONE",
        "sexualContentGraphicAndNudity": "NONE",
        "sexualContentOrNudity": "NONE",
        "horrorOrFearThemes": "NONE",
        "matureOrSuggestiveThemes": "NONE",
        "violenceCartoonOrFantasy": "NONE",
        "violenceRealisticProlongedGraphicOrSadistic": "NONE",
        "violenceRealistic": "NONE",
        "gunsOrOtherWeapons": "NONE",
        # capability flags -> False
        "healthOrWellnessTopics": False,
        "gambling": False,
        "unrestrictedWebAccess": False,
        "lootBox": False,
        "messagingAndChat": False,
        "userGeneratedContent": False,
        "parentalControls": False,
        "advertising": False,
        "ageAssurance": False,
        "kidsAgeBand": None,
    }
    print("• age rating -> 4+ (all NONE)")
    call("PATCH", f"/v1/ageRatingDeclarations/{aid}",
         {"data": {"type": "ageRatingDeclarations", "id": aid, "attributes": attrs}})
    print("agerating done.")

def cmd_privacy():
    # Declare "Data Not Collected" then publish.
    print("• existing appDataUsages")
    cur = jget(f"/v1/apps/{APP_ID}/appDataUsages?limit=200").get("data", [])
    for u in cur:
        call("DELETE", f"/v1/appDataUsages/{u['id']}")
    print("• declare DATA_NOT_COLLECTED")
    call("POST", "/v1/appDataUsages", {
        "data": {"type": "appDataUsages", "relationships": {
            "app": {"data": {"type": "apps", "id": APP_ID}},
            "category": {"data": {"type": "appDataUsageCategories", "id": "DATA_NOT_COLLECTED"}}}}})
    print("• publish privacy")
    call("PATCH", f"/v1/apps/{APP_ID}/relationships/appDataUsagesPublishState",
         {"data": {"type": "appDataUsagesPublishStates",
                   "id": APP_ID, "attributes": {"published": True}}})
    print("privacy done.")

def cmd_review():
    d = discover()
    vid = d["version_id"]
    existing = jget(f"/v1/appStoreVersions/{vid}/appStoreReviewDetail").get("data")
    if existing:
        rid = existing["id"]
        print("• update review detail")
        call("PATCH", f"/v1/appStoreReviewDetails/{rid}",
             {"data": {"type": "appStoreReviewDetails", "id": rid, "attributes": REVIEW_CONTACT}})
    else:
        print("• create review detail")
        call("POST", "/v1/appStoreReviewDetails", {
            "data": {"type": "appStoreReviewDetails", "attributes": REVIEW_CONTACT,
                     "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    print("review done.")

def cmd_submit():
    d = discover()
    vid = d["version_id"]
    print("• create reviewSubmission / appStoreVersionSubmission")
    # Newer reviewSubmissions flow:
    status, txt = request("POST", "/v1/reviewSubmissions", {
        "data": {"type": "reviewSubmissions",
                 "attributes": {"platform": "IOS"},
                 "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}})
    if status in (200, 201):
        sub = json.loads(txt)["data"]; sub_id = sub["id"]
        print("  reviewSubmission", sub_id, "-> add version item")
        call("POST", "/v1/reviewSubmissionItems", {
            "data": {"type": "reviewSubmissionItems",
                     "relationships": {
                         "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
                         "appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
        print("  submit reviewSubmission")
        call("PATCH", f"/v1/reviewSubmissions/{sub_id}",
             {"data": {"type": "reviewSubmissions", "id": sub_id, "attributes": {"submitted": True}}})
        print("SUBMITTED ✅ (reviewSubmissions)")
        return
    print(f"  reviewSubmissions failed HTTP {status}: {txt[:400]}\n  falling back to appStoreVersionSubmissions")
    call("POST", "/v1/appStoreVersionSubmissions", {
        "data": {"type": "appStoreVersionSubmissions",
                 "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    print("SUBMITTED ✅ (appStoreVersionSubmissions)")

CMDS = {"status": cmd_status, "metadata": cmd_metadata, "screenshots": cmd_screenshots,
        "agerating": cmd_agerating, "privacy": cmd_privacy, "review": cmd_review, "submit": cmd_submit}

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "status"
    if arg == "all":
        for c in ("metadata", "screenshots", "agerating", "privacy", "review"):
            print(f"\n==== {c} ====")
            CMDS[c]()
    else:
        CMDS[arg]()
