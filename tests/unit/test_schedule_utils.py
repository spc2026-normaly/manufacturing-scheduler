import pytest
from app.routers.schedule_generator import is_structured_schedule_csv, extract_text_from_bytes

@pytest.mark.parametrize("header,expected", [
    ("order_num,task_id,start_date,end_date", True),
    ("order_id;task_id;start_date;end_date", True),
    ("order,task,start,end", False),
])
def test_is_structured_schedule_csv(header, expected):
    txt = f"{header}\n1,task1,2022-01-01,2022-01-02"
    assert is_structured_schedule_csv(txt) == expected

def test_extract_text_from_bytes_csv():
    data = b"col1,col2\nval1,val2"
    result = extract_text_from_bytes(data, "sample.csv")
    assert result == "col1,col2\nval1,val2"
