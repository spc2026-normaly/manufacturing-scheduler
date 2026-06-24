export async function fetchSchedulesApi(
  view: string,
  dateStr: string,
  factoryFilter?: string,
  orderNumFilter?: string
): Promise<Response> {
  const params = new URLSearchParams({
    view,
    date: dateStr,
  });
  if (factoryFilter && factoryFilter !== "전체") {
    params.append("factory", factoryFilter);
  }
  if (orderNumFilter && orderNumFilter.trim()) {
    params.append("order_num", orderNumFilter.trim());
  }

  return fetch(`/api/schedules/calendar?${params.toString()}`);
}

export async function fetchSummaryApi(dateStr: string): Promise<Response> {
  const params = new URLSearchParams({
    date: dateStr,
  });
  return fetch(`/api/schedules/summary?${params.toString()}`);
}

export async function fetchOrdersApi(): Promise<Response> {
  return fetch("/api/orders");
}
