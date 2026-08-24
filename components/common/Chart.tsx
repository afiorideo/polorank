import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type ChartProps ={
   labels: string[],
   series: (number | null)[],
   reverse? : boolean,
   noMaxLimit?: boolean
}

const Chart = ({ labels, series, reverse = true, noMaxLimit = false }:ChartProps) => {
   const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      scales: {
         y: {
            reverse,
            min: 1,
            max: !noMaxLimit && reverse ? 100 : undefined,
            grace: noMaxLimit ? '15%' : undefined,
            ticks: { precision: 0 },
         },
         x: {
            ticks: { maxTicksLimit: 12, maxRotation: 0 },
         },
      },
      plugins: {
         legend: {
             display: false,
         },
     },
   };

   return <Line
            datasetIdKey='XXX'
            options={options}
            data={{
            labels,
            datasets: [
               {
                  fill: 'start',
                  data: series,
                  spanGaps: false,
                  tension: 0.2,
                  pointRadius: series.length > 60 ? 0 : 2,
                  borderColor: 'rgb(31, 205, 176)',
                  backgroundColor: 'rgba(31, 205, 176, 0.5)',
               },
            ],
            }}
         />;
};

export default Chart;
