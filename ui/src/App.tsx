import { Box, Button, Flex, HStack, Select } from "@chakra-ui/react";
import {
  Axis,
  BarSeries,
  Chart,
  niceTimeFormatByDay,
  Position,
  ScaleType,
  Settings,
  timeFormatter,
  XYBrushArea,
} from "@elastic/charts";
import {orderBy, toPairs} from "lodash";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "react-query";
import { api, CPUTimeSeries } from "./utils/api";

function useSeriesData(
    instance: string,
    top: string | null,
    timeRange: [number, number] | null,
    window: string | null
) {
  return useQuery(
    ["getSeriesData", instance, top, timeRange, window],
    () => api.getCPUTimeData(instance, top, timeRange, window),
    {
      enabled: instance.length > 0,
      refetchOnWindowFocus: false,
      refetchInterval: 5000,
    }
  );
}

const formatter = timeFormatter(niceTimeFormatByDay(1));
const fullFormatter = timeFormatter("YYYY-MM-DD HH:mm:ss");

function App() {
  const { data: instances } = useQuery("getInstances", api.getInstances);
  const [instance, setInstance] = useState<string | null>(null);

  const topOptions = ["2", "5", "10", "20", "50", "100"]
  const [top, setTop] = useState<string | null>(null)

  const windowOptions = ["1m", "5m", "20m", "30m", "1h", "3h", "6h", "12h", "24h"]
  const [window, setWindow] = useState<string | null>(null)

  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);

  const { data: seriesData } = useSeriesData(instance ?? "", top, timeRange, window);

  const handleInstanceChange = useCallback((e) => {
    setInstance(e.target.value);
  }, []);

  const handleTopChange = useCallback((e) => {
    setTop(e.target.value);
  }, [])

  const handleWindowChange = useCallback((e) => {
    setWindow(e.target.value);
  }, [])

  const plotContainer = useRef(null);

  const handleBrushEnd = useCallback((v: XYBrushArea) => {
    if (v.x) {
      setTimeRange(v.x);
    }
  }, []);

  const handleResetTimeRange = useCallback(() => {
    setTimeRange(null);
  }, []);

  const chartData = useMemo(() => {
    if (!seriesData) {
      return { data: [] };
    }

    console.log(seriesData)

    // Group by SQL digest + timestamp and sum their values
    const valuesByDigest: Record<string, CPUTimeSeries> = {};
    const sumByDigest: Record<string, number> = {};
    seriesData.forEach((series) => {
      valuesByDigest[series.sql_digest] = series;

      sumByDigest[series.sql_digest] = 0;
      for (const cpu of series.cpu_time_millis) {
        sumByDigest[series.sql_digest] += cpu;
      }
    });

    console.log(valuesByDigest)
    console.log(sumByDigest)

    // Order by digest
    const orderedDigests = orderBy(
        toPairs(sumByDigest),
      ["1", "0"],
      ["desc"]
    ).map((d) => d[0]);

    const data: Array<Group> = [];
    for (const digest of orderedDigests) {
      const series: Array<[number, number]> = [];
      const rawSeries = valuesByDigest[digest];

      const len = rawSeries.cpu_time_millis.length;
      for (let i = 0; i < len; i++) {
        let ts = rawSeries.timestamp_secs[i]*1000;
        let cpu = rawSeries.cpu_time_millis[i];
        series.push([ts, cpu]);
      }

      data.push({
        Label: {
          SQLDigest: rawSeries.sql_digest,
          SQLText: rawSeries.sql_text
        },
        Series: series
      });
    }

    console.log(data)

    return { data };
  }, [seriesData, timeRange]);

  return (
    <Flex direction="column" height="100%">
      <Box>
        <HStack spacing="8px">
          <Box>
            <Select
              placeholder="Select Instance"
              onChange={handleInstanceChange}
            >
              {instances &&
                instances.map((i) => (
                  <option value={i.instance} key={i.instance}>
                    {i.job} - {i.instance}
                  </option>
                ))}
            </Select>
          </Box>
          <Box>
            <Select
                placeholder="Select Top"
                onChange={handleTopChange}
            >
              {topOptions.map((opt) => (
                  <option value={opt} key={opt}>
                    {opt}
                  </option>
              ))}
            </Select>
          </Box>
          <Box>
            <Select
                placeholder="Select Window"
                onChange={handleWindowChange}
            >
              {windowOptions.map((opt) => (
                  <option value={opt} key={opt}>
                    {opt}
                  </option>
              ))}
            </Select>
          </Box>
          <Box>
            {timeRange && (
              <Button
                variant="outline"
                colorScheme="blue"
                onClick={handleResetTimeRange}
              >
                Reset Time Range (now: {fullFormatter(timeRange[0])} ~{" "}
                {fullFormatter(timeRange[1])})
              </Button>
            )}
          </Box>
        </HStack>
      </Box>
      <Box ref={plotContainer} marginTop={8} height={600}>
        <Chart>
          <Settings
            showLegend
            legendPosition={Position.Right}
            onBrushEnd={handleBrushEnd}
          />
          <Axis
            id="bottom"
            position={Position.Bottom}
            showOverlappingTicks
            tickFormat={formatter}
          />
          <Axis id="left" position={Position.Left} />
          {chartData.data && chartData.data.map((group) => {
            return (
              <BarSeries
                key={group.Label.SQLDigest}
                id={group.Label.SQLDigest}
                xScaleType={ScaleType.Time}
                yScaleType={ScaleType.Linear}
                xAccessor={0}
                yAccessors={[1]}
                stackAccessors={[0]}
                data={group.Series}
                name={group.Label.SQLText.length > 0 ? group.Label.SQLText : group.Label.SQLDigest}
              />
            );
          })}
        </Chart>
      </Box>
    </Flex>
  );
}

type Label = {
  SQLDigest: string;
  SQLText: string;
};

type Group = {
  Label: Label;
  Series: Array<[number, number]>;
};

export default App;
