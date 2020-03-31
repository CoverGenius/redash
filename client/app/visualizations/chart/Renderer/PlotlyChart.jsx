import { isArray, isObject, isEqual } from "lodash";
import React, { useState, useEffect, useContext, memo } from "react";
import useMedia from "use-media";
import { ErrorBoundaryContext } from "@/components/ErrorBoundary";
import { RendererPropTypes } from "@/visualizations/prop-types";
import resizeObserver from "@/services/resizeObserver";
import axiosLib from "axios";

import getChartData from "../getChartData";
import { Plotly, prepareData, prepareLayout, updateData, applyLayoutFixes } from "../plotly";
import {cleanNumber, normalizeValue} from "@/visualizations/chart/plotly/utils";

function catchErrors(func, errorHandler) {
  return (...args) => {
    try {
      return func(...args);
    } catch (error) {
      errorHandler.handleError(error);
    }
  };
}

const PlotlyChart = function({ options, data }) {

  const [container, setContainer] = useState(null);
  const errorHandler = useContext(ErrorBoundaryContext);
  const isMobile = useMedia({ maxWidth: 768 });
  let cancels = [];

  useEffect(
    catchErrors(() => {
      if (container) {
        // bRiGhTwRiTe aDdItIoN
        async function loadPredictions() {
          const CancelToken = axiosLib.CancelToken;
          const plotlyOptions = {showLink: false, displaylogo: false};

          const chartData = getChartData(data.rows, options);
          let plotlyData = prepareData(chartData, options);
          const plotlyLayout = {...prepareLayout(container, options, plotlyData), dragmode: !isMobile ? "zoom" : false};

          if (options.brightWritePrediction && options.brightWritePrediction.enabled) {
            plotlyData[0]['mode'] = 'markers';
            plotlyData[0]['marker'] =  {...plotlyData[0]['marker'], size: 4, color: 'rgba(33, 33, 33, 0.63)'};

            let promises = plotlyData.map(data => {
              return axiosLib.post(options.brightWritePrediction.uri, {
                dates: data['x'],
                values: data['y'],
                config: options.brightWritePrediction.prophetConfig,
                query_hash: options.brightWritePrediction.queryHash
              }, {
                cancelToken: new CancelToken(function executor(c) {
                  cancels.push(c);
                })
              });
            });
            const traceNames = plotlyData.map(x => x['name']);
            let results = await Promise.all(promises);
            results.forEach((trace, i) => {
              ['yhat_upper', 'yhat_lower', 'yhat'].forEach(field => {
                let sourceData = new Map();
                let xValues = [];
                let yValues = [];
                let yErrorValues = [];
                const x = normalizeValue(trace['data']['ds'], 'datetime'); // number/datetime/category
                const y = trace['data'][field];
                const yError = cleanNumber(trace['data'].yError); // always number
                const size = cleanNumber(trace['data'].size); // always number
                sourceData.set(x, {
                  x,
                  y,
                  yError,
                  size,
                  yPercent: null, // will be updated later
                  row: trace['data']
                });
                xValues.push(x);
                yValues.push(y);
                yErrorValues.push(yError);

                const nameMap = {
                  'yhat': 'forecast',
                  'yhat_upper': 'Upper Bound',
                  'yhat_lower': 'Lower Bound',
                };


                plotlyData = [{
                  x: trace['data']['ds'],
                  y: trace['data'][field],
                  fill: nameMap[field].indexOf('Upper') > -1 ? 'tonexty' : null,
                  line: nameMap[field].indexOf('Bound') > -1 ? {"color": 'rgba(108, 185, 255, 0.5)'} : {},
                  mode: nameMap[field].indexOf('Bound') > -1 ? null : 'lines',
                  name: traceNames[i] + ' ' + nameMap[field],
                  visible: true,
                  yaxis: "y",
                  dash: field !== 'yhat' ? 'dash' : null,
                  sourceData: sourceData
                }, ...plotlyData];
              });
            });
          }

          Plotly.newPlot(container, plotlyData, plotlyLayout, plotlyOptions).then(
            catchErrors(() => {
              applyLayoutFixes(container, plotlyLayout, (e, u) => Plotly.relayout(e, u));
            }, errorHandler)
          );

          container.on(
            "plotly_restyle",
            catchErrors(updates => {
              // This event is triggered if some plotly data/layout has changed.
              // We need to catch only changes of traces visibility to update stacking
              if (isArray(updates) && isObject(updates[0]) && updates[0].visible) {
                updateData(plotlyData, options);
                Plotly.relayout(container, plotlyLayout);
              }
            }, errorHandler)
          );

          const unwatch = resizeObserver(
            container,
            catchErrors(() => {
              applyLayoutFixes(container, plotlyLayout, (e, u) => Plotly.relayout(e, u));
            }, errorHandler)
          );
          return unwatch;
        }
        loadPredictions();
      }
    }, errorHandler),
    [options, data, container, isMobile]
  );

  // Cleanup when component destroyed
  useEffect(() => {
    if (container) {
      return () => {
        cancels.forEach(c => c());
        Plotly.purge(container);
      }
    }
  }, [container, cancels]);

  return <div className="chart-visualization-container" ref={setContainer} />;
}

PlotlyChart.propTypes = RendererPropTypes;


export default memo(PlotlyChart, (prevProps, nextProps) => {
  return isEqual(prevProps.options, nextProps.options) &&
   isEqual(prevProps.data, nextProps.data);
});
