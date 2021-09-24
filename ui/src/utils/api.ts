import axios from "axios";

const client = axios.create({
  baseURL:  "http://127.0.0.1:8428/topsql/v1",
});

export type Instance = {
  instance: string;
  job: string;
};

export type GetInstanceResponse = Instance[];

export type CPUTimeSeries = {
  sql_digest: string;
  plan_digest: string;
  sql_text: string;
  plan_text: string;
  timestamp_secs: number[];
  cpu_time_millis: number[];
};

export type GetCPUTimeDataResponse = CPUTimeSeries[];

export const api = {
  async getInstances(): Promise<GetInstanceResponse> {
    const r = await client.get("/instances");
    return r.data.data;
  },

  async getCPUTimeData(
      instance: string,
      top: string | null,
      timeRange: [number, number] | null,
      window: string | null,
  ): Promise<GetCPUTimeDataResponse> {
    let start = null;
    if (timeRange) {
      start = timeRange[0] / 1000;
    }
    let end = null;
    if (timeRange) {
      end = timeRange[1] / 1000;
    }
    if (top?.length == 0) {
      top = "-1";
    }
    const r = await client.get(
        `/cpu_time`,
        { params: { instance, top, start, end, window }},
    );
    return r.data.data;
  },
};
