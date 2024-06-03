class LineChart {
    margin = {
        top: 10, right: 100, bottom: 40, left: 40
    }

    constructor(svg, data, width = 800, height = 250) {
        this.svg = svg;
        this.data = data;
        this.width = width;
        this.height = height;

        this.handlers = {};
    }

    initialize() {
        this.svg = d3.select(this.svg);
        this.container = this.svg.append("g");
        this.xAxis = this.svg.append("g");
        this.yAxis = this.svg.append("g");
        this.legend = this.svg.append("g");

        this.xScale = d3.scaleTime();
        this.yScale = d3.scaleLinear();
        this.zScale = d3.scaleOrdinal()
            .domain(["Positive", "Neutral", "Negative"])
            .range(["blue", "red", "green"]);

        this.svg
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.container.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        this.clip = this.svg.append("defs").append("svg:clipPath")
            .attr("id", "clip")
            .append("svg:rect")
            .attr("width", this.width )
            .attr("height", this.height )
            .attr("x", 0)
            .attr("y", 0);
        
        this.container.attr("clip-path", "url(#clip)");

        this.line = d3.line()
            .x(d => this.xScale(d.date))
            .y(d => this.yScale(d.value));
        
        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.height]])
            .on("end", (event) => {
                this.zoomChart(event);
            })
    }

    update(sentiment, country, platform, hashtag) {
        this.args = [sentiment, country, platform, hashtag];
        var color = {Positive: "blue", Neutral: "green", Negative: "red"};
        const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
        
        const filteredData = this.data.filter(d => {
            return  (sentiment === "All" || d.Sentiment === sentiment) &&
                    (country === "All" || d.Country === country) &&
                    (!hashtag || d.Hashtags.includes(hashtag)) &&
                    (platform === "All" || d.Platform === platform);
        });
        
        filteredData.forEach(d => {
            d.date = parseTime(d.Timestamp);
            d.value = d.Retweets + d.Likes;
        });
        // console.log(sentiment, country, platform);
        // console.log(filteredData);

        this.xScale.domain(d3.extent(filteredData, d => d.date)).range([0, this.width]);
        this.yScale.domain([0, d3.max(filteredData, d => d.value)]).range([this.height, 0]);
        this.zScale.domain([...new Set(this.data.map(d => d.Sentiment))]);

        const lineData = d3.groups(filteredData, d => d.Sentiment).map(group => {
            return [group[0], group[1].sort((a, b) => d3.ascending(a.date, b.date))];
        });

        this.container.selectAll(".line").remove();

        this.lines = this.container.selectAll(".line")
            .data(lineData)
            .enter()
            .append("path")
                .attr("class", "line")
                .attr("fill", "none")
                .attr("stroke", d => color[d[0]])
                .attr("stroke-width", 1.5)
                .attr("d", d => this.line(d[1]));
        
        this.container
            .append("g")
            .attr("class", "brush")
            .call(this.brush);    

        this.xAxis
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top + this.height})`)
            .transition()
            .call(d3.axisBottom(this.xScale));

        this.yAxis
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
            .transition()
            .call(d3.axisLeft(this.yScale));
        
        this.legend
            .style("display", "inline")
            .style("font-size", ".8em")
            .attr("transform", `translate(${this.width + this.margin.left + 10}, ${this.height / 2})`)
            .call(d3.legendColor().scale(this.zScale))
    }

    zoomChart(event) {
        if (!event.selection) return;
        let extent = event.selection.map(this.xScale.invert, this.xScale);
        this.xScale.domain(extent);
        this.container.selectAll(".brush").call(this.brush.move, null);

        this.xAxis.transition().duration(1000).call(d3.axisBottom(this.xScale))
        this.lines
            .transition()
            .duration(1000)
            .attr("d", d => this.line(d[1]));
    }
    
    on(eventType, handler) {
        this.handlers[eventType] = handler;
    }
}