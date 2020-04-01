import {isArray, map, mapValues, includes, some, each, difference, toNumber} from "lodash";
import Input from "antd/lib/input";
import React, { useMemo } from "react";
import * as Grid from "antd/lib/grid";
import { Section, Select, Checkbox, InputNumber } from "@/components/visualizations/editor";
import { UpdateOptionsStrategy } from "@/components/visualizations/editor/createTabbedEditor";
import { EditorPropTypes } from "@/visualizations/prop-types";

import ChartTypeSelect from "./ChartTypeSelect";
import ColumnMappingSelect from "./ColumnMappingSelect";

function getAvailableColumnMappingTypes(options) {
  const result = ["x", "y"];

  if (!includes(["custom", "heatmap"], options.globalSeriesType)) {
    result.push("series");
  }

  if (options.globalSeriesType === "bubble" || some(options.seriesOptions, { type: "bubble" })) {
    result.push("size");
  }

  if (options.globalSeriesType === "heatmap") {
    result.push("zVal");
  }

  if (!includes(["custom", "bubble", "heatmap"], options.globalSeriesType)) {
    result.push("yError");
  }

  return result;
}

function getMappedColumns(options, availableColumns) {
  const mappedColumns = {};
  const availableTypes = getAvailableColumnMappingTypes(options);
  each(availableTypes, type => {
    mappedColumns[type] = ColumnMappingSelect.MappingTypes[type].multiple ? [] : null;
  });

  availableColumns = map(availableColumns, c => c.name);
  const usedColumns = [];

  each(options.columnMapping, (type, column) => {
    if (includes(availableColumns, column) && includes(availableTypes, type)) {
      const { multiple } = ColumnMappingSelect.MappingTypes[type];
      if (multiple) {
        mappedColumns[type].push(column);
      } else {
        mappedColumns[type] = column;
      }
      usedColumns.push(column);
    }
  });

  return {
    mappedColumns,
    unusedColumns: difference(availableColumns, usedColumns),
  };
}

function mappedColumnsToColumnMappings(mappedColumns) {
  const result = {};
  each(mappedColumns, (value, type) => {
    if (isArray(value)) {
      each(value, v => {
        result[v] = type;
      });
    } else {
      if (value) {
        result[value] = type;
      }
    }
  });
  return result;
}

export default function GeneralSettings({ options, data, onOptionsChange }) {
  const { mappedColumns, unusedColumns } = useMemo(() => getMappedColumns(options, data.columns), [
    options,
    data.columns,
  ]);

  function handleGlobalSeriesTypeChange(globalSeriesType) {
    onOptionsChange({
      globalSeriesType,
      showDataLabels: globalSeriesType === "pie",
      seriesOptions: mapValues(options.seriesOptions, series => ({
        ...series,
        type: globalSeriesType,
      })),
    });
  }

  function handleColumnMappingChange(column, type) {
    const columnMapping = mappedColumnsToColumnMappings({
      ...mappedColumns,
      [type]: column,
    });
    onOptionsChange({ columnMapping }, UpdateOptionsStrategy.shallowMerge);
  }

  return (
    <React.Fragment>
      <Section>
        <ChartTypeSelect
          label="Chart Type"
          className="w-100"
          data-test="Chart.GlobalSeriesType"
          defaultValue={options.globalSeriesType}
          onChange={handleGlobalSeriesTypeChange}
        />
      </Section>

      {map(mappedColumns, (value, type) => (
        <ColumnMappingSelect
          key={type}
          type={type}
          value={value}
          availableColumns={unusedColumns}
          onChange={handleColumnMappingChange}
        />
      ))}

      {includes(["bubble"], options.globalSeriesType) && (
        <React.Fragment>
          <Section>
            <InputNumber
              label="Bubble Size Coefficient"
              className="w-100"
              data-test="Chart.BubbleCoefficient"
              defaultValue={options.coefficient}
              onChange={value => onOptionsChange({ coefficient: toNumber(value) })}
            />
          </Section>

          <Section>
            <Select
              label="Bubble Size Proportional To"
              className="w-100"
              data-test="Chart.SizeMode"
              defaultValue={options.sizemode}
              onChange={mode => onOptionsChange({ sizemode: mode })}>
              <Select.Option value="area" data-test="Chart.SizeMode.Area">
                Area
              </Select.Option>
              <Select.Option value="diameter" data-test="Chart.SizeMode.Diameter">
                Diameter
              </Select.Option>
            </Select>
          </Section>
        </React.Fragment>
      )}

      {includes(["pie"], options.globalSeriesType) && (
        <Section>
          <Select
            label="Direction"
            className="w-100"
            data-test="Chart.PieDirection"
            defaultValue={options.direction.type}
            onChange={type => onOptionsChange({ direction: { type } })}>
            <Select.Option value="counterclockwise" data-test="Chart.PieDirection.Counterclockwise">
              Counterclockwise
            </Select.Option>
            <Select.Option value="clockwise" data-test="Chart.PieDirection.Clockwise">
              Clockwise
            </Select.Option>
          </Select>
        </Section>
      )}

      {!includes(["custom", "heatmap"], options.globalSeriesType) && (
        <Section>
          <Checkbox
            data-test="Chart.ShowLegend"
            defaultChecked={options.legend.enabled}
            onChange={event => onOptionsChange({ legend: { enabled: event.target.checked } })}>
            Show Legend
          </Checkbox>
        </Section>
      )}

      {includes(["box"], options.globalSeriesType) && (
        <Section>
          <Checkbox
            data-test="Chart.ShowPoints"
            defaultChecked={options.showpoints}
            onChange={event => onOptionsChange({ showpoints: event.target.checked })}>
            Show All Points
          </Checkbox>
        </Section>
      )}

      {!includes(["custom", "heatmap"], options.globalSeriesType) && (
        <Section>
          <Select
            label="Stacking"
            className="w-100"
            data-test="Chart.Stacking"
            defaultValue={options.series.stacking}
            disabled={!includes(["line", "area", "column"], options.globalSeriesType)}
            onChange={stacking => onOptionsChange({ series: { stacking } })}>
            <Select.Option value={null} data-test="Chart.Stacking.Disabled">
              Disabled
            </Select.Option>
            <Select.Option value="stack" data-test="Chart.Stacking.Stack">
              Stack
            </Select.Option>
          </Select>
        </Section>
      )}

      {includes(["line", "area", "column"], options.globalSeriesType) && (
        <Section>
          <Checkbox
            data-test="Chart.NormalizeValues"
            defaultChecked={options.series.percentValues}
            onChange={event => onOptionsChange({ series: { percentValues: event.target.checked } })}>
            Normalize values to percentage
          </Checkbox>
        </Section>
      )}

      {(options.globalSeriesType === 'line') && (
        <Section>
          <Checkbox
            data-test="Chart.NormalizeValues"
            defaultChecked={options.brightWritePrediction.enabled}
            onChange={event => onOptionsChange({ brightWritePrediction: { enabled: event.target.checked } })}>
            BrightWrite Prediction <sup style={{color: '#e8ad00', fontWeight: 'bold'}}>Beta</sup>
          </Checkbox>
        </Section>
      )}
      {/* bRiGhTwRiTe aDdItIoN */}
      {(options.brightWritePrediction.enabled) && (
      <React.Fragment>
        <Section>
          <div className="m-b-15">
            <label>Service URI</label>
            <Input
              data-test="PredictionServiceURI"
              id="prediction-service-uri"
              className="w-100"
              value={options.brightWritePrediction.uri}
              onChange={event => onOptionsChange({ brightWritePrediction: { uri: event.target.value } })}
            />
            </div>
        </Section>
        <Section>
         <label>Prophet Parameters</label>
          <Grid.Row gutter={15} type="flex" align="middle">
            <Grid.Col span={12}>
              <InputNumber
                label="Seasonality Strength"
                className="w-100"
                placeholder="Seasonality Strength"
                data-test={options.brightWritePrediction.prophetConfig.seasonality_prior_scale}
                defaultValue={toNumber(options.brightWritePrediction.prophetConfig.seasonality_prior_scale)}
                onChange={value => onOptionsChange({ brightWritePrediction:
                    { prophetConfig: {seasonality_prior_scale: toNumber(value) }}
                  }
                )}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <InputNumber
                label="Change Point Strength"
                className="w-100"
                placeholder="Change Point Strength"
                data-test={options.brightWritePrediction.prophetConfig.changepoint_prior_scale}
                defaultValue={toNumber(options.brightWritePrediction.prophetConfig.changepoint_prior_scale)}
                onChange={value => onOptionsChange({ brightWritePrediction:
                    { prophetConfig: {changepoint_prior_scale: toNumber(value) }}
                  }
                )}
              />
            </Grid.Col>
          </Grid.Row>
          <Grid.Row gutter={15} type="flex" align="middle">
            <Grid.Col span={12}>
              <Select
                label="Seasonality Model"
                className="w-100"
                data-test="options.brightWritePrediction.prophetConfig.seasonality_mode"
                defaultValue={options.brightWritePrediction.prophetConfig.seasonality_mode}
                onChange={stacking => onOptionsChange({ brightWritePrediction: { prophetConfig: { seasonality_mode: stacking } } })}>
                <Select.Option value='additive'>
                  Additive
                </Select.Option>
                <Select.Option value="multiplicative">
                  Multiplicative
                </Select.Option>
              </Select>

            </Grid.Col>
            <Grid.Col span={12}>
              <InputNumber
                label="Predictive Interval Width"
                className="w-100"
                placeholder="Predictive Interval Width"
                data-test={options.brightWritePrediction.prophetConfig.interval_width}
                defaultValue={toNumber(options.brightWritePrediction.prophetConfig.interval_width)}
                onChange={value => onOptionsChange({ brightWritePrediction:
                    { prophetConfig: {interval_width: toNumber(value) }}
                  }
                )}
              />
            </Grid.Col>
          </Grid.Row>
        </Section>
      </React.Fragment>
      )}
      {!includes(["custom", "heatmap", "bubble", "scatter"], options.globalSeriesType) && (
        <Section>
          <Select
            label="Missing and NULL values"
            className="w-100"
            data-test="Chart.MissingValues"
            defaultValue={options.missingValuesAsZero ? 1 : 0}
            onChange={value => onOptionsChange({ missingValuesAsZero: !!value })}>
            <Select.Option value={0} data-test="Chart.MissingValues.Keep">
              Do not display in chart
            </Select.Option>
            <Select.Option value={1} data-test="Chart.MissingValues.Zero">
              Convert to 0 and display in chart
            </Select.Option>
          </Select>
        </Section>
      )}
    </React.Fragment>
  );
}

GeneralSettings.propTypes = EditorPropTypes;
