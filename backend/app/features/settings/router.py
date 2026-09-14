"""Defaults and plain-language descriptions for every adjustable rule
(docs/features.md §3.13 and §3.14). The frontend renders the settings page from this."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.models import BufferSettings, Rules

router = APIRouter(prefix="/settings", tags=["settings"])

BUFFER_METHODS: list[dict[str, Any]] = [
    {
        "id": "ccpm",
        "title": "รวมเผื่อไว้ท้ายโครงการ",
        "recommended": True,
        "what": 'กรอกเวลาแต่ละงานแบบ "ถ้าราบรื่นจะเสร็จใน" โดยไม่ต้องเผื่อ แล้วระบบรวมเวลาเผื่อของทั้งโครงการไว้เป็นก้อนเดียวท้ายสุด เท่ากับครึ่งหนึ่งของสายงานหลัก',
        "fit": "คุณตั้งใจกรอกเวลาแบบไม่เผื่อ และอยากเห็นชัดว่าเผื่อไว้กี่วัน ใช้ไปแล้วเท่าไร",
        "reference": "Critical Chain (Goldratt)",
        "options": {"ccpmRatio": {"min": 30, "max": 50, "step": 5, "default": 50, "unit": "%"}},
    },
    {
        "id": "percent",
        "title": "บวกเพิ่มตามความเสี่ยง",
        "recommended": False,
        "what": "กรอกเวลาแบบปกติ (เผื่อในตัวเล็กน้อยได้) แล้วบวกเพิ่มท้ายโครงการตามระดับความเสี่ยง ต่ำ 10% กลาง 15% สูง 25%",
        "fit": "คุณกรอกเวลาแบบที่คุ้นเคย หรือรับแผนมาจากคนอื่นที่เผื่อไว้แล้ว",
        "reference": "PMBOK Contingency reserve",
        "options": {
            "riskLevel": [
                {"id": "low", "label": "ต่ำ 10%"},
                {"id": "medium", "label": "กลาง 15%"},
                {"id": "high", "label": "สูง 25%"},
            ]
        },
    },
    {
        "id": "pert",
        "title": "ประเมิน 3 ค่า",
        "recommended": False,
        "what": "กรอก 3 ค่าต่องาน เร็วสุด / ปกติ / ช้าสุด ระบบคำนวณเวลาที่น่าจะเป็น และเผื่อตามความมั่นใจที่เลือก (84% หรือ 98%)",
        "fit": "งานมีความไม่แน่นอนต่างกันมาก และคุณยอมกรอกข้อมูลเพิ่ม",
        "reference": "PERT three-point estimate",
        "options": {
            "pertConfidence": [{"id": 84, "label": "มั่นใจ 84%"}, {"id": 98, "label": "มั่นใจ 98%"}]
        },
    },
]

RULES: list[dict[str, Any]] = [
    {
        "id": "nearCriticalFloatDays",
        "title": "งานไหนนับเป็น critical",
        "reference": "Critical Path Method",
        "options": [
            {"value": 0, "label": "เลื่อนไม่ได้เลย", "help": "งานที่เลื่อนแล้วโครงการเลื่อนตามทันที"},
            {
                "value": 2,
                "label": "รวมงานที่เลื่อนได้ไม่เกิน N วัน",
                "help": "จับตางานที่เกือบ critical ล่วงหน้า",
            },
        ],
    },
    {
        "id": "progressRollup",
        "title": "รวมความคืบหน้าของกลุ่มอย่างไร",
        "reference": "Earned Value",
        "options": [
            {"value": "duration", "label": "ถ่วงน้ำหนักด้วยระยะเวลา", "help": "งานยาวมีน้ำหนักมากกว่า"},
            {"value": "count", "label": "นับจำนวนงานที่เสร็จ", "help": "ทุกงานเท่ากัน ง่ายแต่หลอกได้"},
            {"value": "effort", "label": "ถ่วงน้ำหนักด้วยแรงคน", "help": "คิดตาม % ที่มอบหมาย × วัน"},
        ],
    },
    {
        "id": "lateDetection",
        "title": "วิธีตรวจว่างานล่าช้า",
        "reference": "Earned Schedule",
        "options": [
            {"value": "linear", "label": "เทียบเวลาที่ผ่านไป", "help": "ผ่านไปครึ่งเวลา ควรได้ครึ่งงาน"},
            {
                "value": "baseline",
                "label": "เทียบกับ baseline",
                "help": "ใช้ได้เมื่อบันทึก baseline แล้ว",
                "disabled": True,
            },
            {"value": "overdue", "label": "เลยกำหนดเท่านั้น", "help": "เตือนเมื่อเลยวันสิ้นสุด"},
        ],
    },
    {
        "id": "overallocationThreshold",
        "title": "ถือว่าเกินกำลังเมื่อรวมงานเกินกี่ % ของวัน",
        "reference": "Resource management",
        "options": {"min": 50, "max": 200, "step": 10, "default": 100, "unit": "%"},
    },
    {
        "id": "lagUnit",
        "title": "เวลารอ (lag) นับอย่างไร",
        "reference": "MS Project / Primavera default",
        "options": [
            {"value": "working", "label": "ข้ามวันหยุด", "help": "รอ 2 วันจากศุกร์ ได้วันอังคาร"},
            {
                "value": "calendar",
                "label": "นับทุกวันรวมวันหยุด",
                "help": "เหมาะกับการรอ เช่น รอปูนแห้ง รอเอกสาร",
            },
        ],
    },
    {
        "id": "defaultDependency",
        "title": "ความสัมพันธ์เริ่มต้นเมื่อลากเชื่อม",
        "reference": "FS พบมากที่สุดในแผนทั่วไป",
        "options": [
            {"value": "FS", "label": "เสร็จแล้วค่อยเริ่ม (FS)"},
            {"value": "SS", "label": "เริ่มพร้อมกัน (SS)"},
            {"value": "FF", "label": "เสร็จพร้อมกัน (FF)"},
            {"value": "SF", "label": "เริ่มก่อนจึงเสร็จได้ (SF)"},
        ],
    },
    {
        "id": "bufferZones",
        "title": "สัญญาณการใช้เวลาเผื่อ",
        "reference": "Fever chart (Critical Chain)",
        "options": {"min": 50, "max": 400, "step": 10, "default": 100, "unit": "%"},
    },
    {
        "id": "schedulingMode",
        "title": "เมื่อลากงานไปวางวันอื่น",
        "reference": "Auto vs manual scheduling",
        "options": [
            {"value": "auto", "label": "ระบบขยับให้ตามความสัมพันธ์", "help": "ดันไปวันที่เป็นไปได้ที่ใกล้ที่สุด"},
            {"value": "manual", "label": "อยู่ที่วางไว้ ระบบแค่เตือน", "help": "ล็อกวันเอง"},
        ],
    },
]


@router.get("/defaults")
def get_defaults() -> dict[str, Any]:
    return {
        "rules": Rules().model_dump(mode="json"),
        "buffer": BufferSettings().model_dump(mode="json"),
        "bufferMethods": BUFFER_METHODS,
        "ruleDescriptions": RULES,
        "managementReserve": {
            "help": "เวลาเผื่อสำหรับเรื่องที่คาดไม่ถึง (management reserve) จะไม่แสดงในแผนที่แชร์",
            "default": 5,
            "unit": "%",
        },
    }
