class WordCloud {
    margin = {
        top: 10, right: 10, bottom: 40, left: 10
    }

    constructor(svg, data, width=800, height=800) {
        this.svg = svg;
        this.data = data;
        this.width = width;
        this.height = height;

        this.handlers = {};
    }

    initialize() {
        this.svg = d3.select(this.svg);
        this.container = this.svg.append("g");


        this.svg
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.container.attr("transform", "translate(" + this.width / 2 + "," + this.height / 2 + ")");
        this.prcessData();
        this.createLayout();
    }

    prcessData() {
        this.wordFreq = {};

        this.data.forEach(entry => {
            entry.Words.forEach(word => {
                if (!this.wordFreq[word]) {
                    this.wordFreq[word] = {count: 0, sentiments: {Positive: 0, Neutral: 0, Negative: 0}};
                }
                this.wordFreq[word].count++;
                this.wordFreq[word].sentiments[entry.Sentiment]++;
            });
        });

        this.words = {Positive: [], Neutral: [], Negative: [], All: []};
        const colors = {Positive: 0, Neutral: 120, Negative: 240};

        Object.keys(this.wordFreq).forEach(word => {
            const sentiments = this.wordFreq[word].sentiments;
            const ratio = {
                Positive: sentiments.Positive / this.wordFreq[word].count,
                Neutral: sentiments.Neutral / this.wordFreq[word].count,
                Negative: sentiments.Negative / this.wordFreq[word].count
            };
            
            Object.keys(ratio).forEach(sentiment => {
                if (ratio[sentiment] > 0) {
                    const lightness  =  ratio[sentiment] <= 0.25 ? 80 :
                                        ratio[sentiment] <= 0.5  ? 60 :
                                        ratio[sentiment] <= 0.75 ? 40 : 20;
                    this.words[sentiment].push({
                        text: word,
                        size: 10 + this.wordFreq[word].count * 2,
                        ratio: ratio[sentiment],
                        color: `hsl(${colors[sentiment]}, 100%, ${lightness}%)`
                    });
                    if (Math.max(...Object.values(ratio)) === ratio[sentiment]) {
                        this.words.All.push({
                            text: word,
                            size: 10 + this.wordFreq[word].count * 2,
                            ratio: ratio[sentiment],
                            color: `hsl(${colors[sentiment]}, 100%, ${lightness}%)`
                        });
                    }
                }
            });
        });
    }

    // ChatGPT
    createLayout() {
        this.layout = d3.layout.cloud()
            .size([this.width, this.height])
            .padding(5)
            .rotate(() => ~~(Math.random() * 2) * 90)
            .font("Impact")
            .fontSize(d => d.size)
            .on("end", this.draw.bind(this));
    }

    // ChatGPT
    draw(words) {
        this.container.selectAll("text").remove();

        this.container.selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", d => d.size + "px")
            .style("font-family", "Impact")
            .style("fill", d => d.color)
            .attr("text-anchor", "middle")
            .attr("transform", d => `translate(${d.x}, ${d.y})rotate(${d.rotate})`)
            .text(d => d.text);
    }

    // ChatGPT
    update(sentiment, ratio, maxWords = 50) {
        let filteredWords = this.words[sentiment].filter(word => word.ratio >= ratio);

        filteredWords = filteredWords.sort((a, b) => b.size - a.size).slice(0, maxWords);
        this.layout.words(filteredWords).start();
    }
}