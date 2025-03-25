import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Define the data structure for Van Westendorp price analysis
interface PricePoint {
  price: number;
  tooExpensive: number;
  expensiveButWorth: number;
  goodValue: number;
  tooCheap: number;
}

interface VanWestendorpProps {
  data?: PricePoint[];
  width?: number;
  height?: number;
  title?: string;
  description?: string;
}

// Sample data if none is provided
const sampleData: PricePoint[] = [
  { price: 10, tooExpensive: 5, expensiveButWorth: 1, goodValue: 20, tooCheap: 80 },
  { price: 30, tooExpensive: 20, expensiveButWorth: 15, goodValue: 60, tooCheap: 50 },
  { price: 50, tooExpensive: 50, expensiveButWorth: 50, goodValue: 50, tooCheap: 20 },
  { price: 70, tooExpensive: 70, expensiveButWorth: 65, goodValue: 25, tooCheap: 15 },
  { price: 90, tooExpensive: 90, expensiveButWorth: 80, goodValue: 10, tooCheap: 5 },
  { price: 110, tooExpensive: 95, expensiveButWorth: 90, goodValue: 5, tooCheap: 2 },
];

export function VanWestendorpChart({
  data = sampleData,
  width = 700,
  height = 400,
  title = "Van Westendorp Price Sensitivity Analysis",
  description = "Price sensitivity analysis showing intersection points that indicate optimal pricing"
}: VanWestendorpProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Setup dimensions
    const margin = { top: 40, right: 80, bottom: 60, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto;");

    // Add group for chart area
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.price) || 110])
      .range([0, chartWidth]);

    // Y scale
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([chartHeight, 0]);

    // Line generators
    const lineGenerator = d3.line<PricePoint>()
      .x(d => xScale(d.price))
      .y(d => yScale(0))
      .curve(d3.curveMonotoneX);

    const tooExpensiveLine = d3.line<PricePoint>()
      .x(d => xScale(d.price))
      .y(d => yScale(d.tooExpensive))
      .curve(d3.curveMonotoneX);

    const expensiveLine = d3.line<PricePoint>()
      .x(d => xScale(d.price))
      .y(d => yScale(d.expensiveButWorth))
      .curve(d3.curveMonotoneX);

    const goodValueLine = d3.line<PricePoint>()
      .x(d => xScale(d.price))
      .y(d => yScale(d.goodValue))
      .curve(d3.curveMonotoneX);

    const tooCheapLine = d3.line<PricePoint>()
      .x(d => xScale(d.price))
      .y(d => yScale(d.tooCheap))
      .curve(d3.curveMonotoneX);

    // Add gridlines
    g.append("g")
      .attr("class", "grid-lines")
      .selectAll("line.horizontal-grid")
      .data(yScale.ticks(5))
      .enter()
      .append("line")
      .attr("class", "horizontal-grid")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#e0e0e0")
      .attr("stroke-dasharray", "3,3");

    g.append("g")
      .attr("class", "grid-lines")
      .selectAll("line.vertical-grid")
      .data(xScale.ticks(5))
      .enter()
      .append("line")
      .attr("class", "vertical-grid")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", chartHeight)
      .attr("stroke", "#e0e0e0")
      .attr("stroke-dasharray", "3,3");

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .append("text")
      .attr("fill", "#000")
      .attr("x", chartWidth / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .text("Price ($)");

    // Add Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).tickFormat(d => `${d}%`))
      .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text("Percentage of Customers");

    // Add lines
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 3)
      .attr("d", tooExpensiveLine)
      .attr("class", "too-expensive-line");

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#f39c12")
      .attr("stroke-width", 3)
      .attr("d", expensiveLine)
      .attr("class", "expensive-line");

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#2ecc71")
      .attr("stroke-width", 3)
      .attr("d", goodValueLine)
      .attr("class", "good-value-line");

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#3498db")
      .attr("stroke-width", 3)
      .attr("d", tooCheapLine)
      .attr("class", "too-cheap-line");

    // Add title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text(title);

    // Add legends
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

    const legendItems = [
      { name: "Too Expensive", color: "#e74c3c" },
      { name: "Expensive But Worth It", color: "#f39c12" },
      { name: "Good Value", color: "#2ecc71" },
      { name: "Too Cheap", color: "#3498db" }
    ];

    legendItems.forEach((item, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`);
      
      legendRow.append("line")
        .attr("x1", 0)
        .attr("y1", 10)
        .attr("x2", 20)
        .attr("y2", 10)
        .style("stroke", item.color)
        .style("stroke-width", 3);
      
      legendRow.append("text")
        .attr("x", 25)
        .attr("y", 10)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(item.name);
    });

    // Add intersection points (find them through data interpolation)
    // This is simplified; in a real implementation, you'd compute exact intersections
    const optimalPricePoint = data.find(d => Math.abs(d.goodValue - d.tooExpensive) < 5);
    const indifferencePricePoint = data.find(d => Math.abs(d.tooCheap - d.expensiveButWorth) < 5);

    if (optimalPricePoint) {
      g.append("circle")
        .attr("cx", xScale(optimalPricePoint.price))
        .attr("cy", yScale(optimalPricePoint.goodValue))
        .attr("r", 5)
        .attr("fill", "#333");
    }

    if (indifferencePricePoint) {
      g.append("circle")
        .attr("cx", xScale(indifferencePricePoint.price))
        .attr("cy", yScale(indifferencePricePoint.tooCheap))
        .attr("r", 5)
        .attr("fill", "#333");
    }

    // Add tooltips (on hover show values)
    const tooltip = d3.select(chartRef.current)
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "5px")
      .style("padding", "10px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("z-index", "10");

    // Add points that will trigger tooltips
    data.forEach(d => {
      g.append("circle")
        .attr("cx", xScale(d.price))
        .attr("cy", yScale(d.tooExpensive))
        .attr("r", 4)
        .attr("fill", "#e74c3c")
        .attr("opacity", 0.7)
        .on("mouseover", function(event) {
          tooltip
            .style("visibility", "visible")
            .html(`
              <strong>Price: $${d.price}</strong><br />
              Too Expensive: ${d.tooExpensive}%<br />
              Expensive But Worth It: ${d.expensiveButWorth}%<br />
              Good Value: ${d.goodValue}%<br />
              Too Cheap: ${d.tooCheap}%
            `)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          tooltip.style("visibility", "hidden");
        });
    });

  }, [data, width, height, title]);

  return (
    <div className="visualization-container">
      <div ref={chartRef} className="chart-container"></div>
      {description && (
        <p className="chart-description">{description}</p>
      )}
    </div>
  );
}

export default VanWestendorpChart;