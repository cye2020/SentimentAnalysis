class ForceDirectedGraph {
    margin = {
        top: 10, right: 100, bottom: 40, left: 40
    };

    constructor(svg, data, width = 800, height = 600) {
        this.svg = svg;
        this.data = data;
        this.width = width;
        this.height = height;

        this.handlers = {};
        this.forceProperties = {
            center: {
                x: 0.5,
                y: 0.5
            },
            charge: {
                enabled: true,
                strength: -30,
                distanceMin: 1,
                distanceMax: 2000
            },
            collide: {
                enabled: true,
                strength: .7,
                iterations: 1,
                radius: 5
            },
            forceX: {
                enabled: false,
                strength: .1,
                x: .5
            },
            forceY: {
                enabled: false,
                strength: .1,
                y: .5
            },
            link: {
                enabled: true,
                distance: 30,
                iterations: 1
            }
        }

        // Initialize zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])  // Define zoom scale limits
            .on("zoom", (event) => this.zoomed(event));
    }

    initialize() {
        this.svg = d3.select(this.svg)
        this.container = this.svg.append("g")

        this.svg
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .call(this.zoom);  // Apply zoom behavior to the SVG
        
        this.container.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        // Set initial zoom to 70%
        const initialScale = 0.5;
        this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(initialScale).translate(-this.width / 2, -this.height / 2));

        this.simulation = d3.forceSimulation();
        this.processData();
    }

    zoomed(event) {
        this.container.attr("transform", event.transform);
    }

    updateForces() {
        // get each force by name and update the properties
        this.simulation.force("center")
            .x(this.width * this.forceProperties.center.x)
            .y(this.height * this.forceProperties.center.y);
        this.simulation.force("charge")
            .strength(this.forceProperties.charge.strength * this.forceProperties.charge.enabled)
            .distanceMin(this.forceProperties.charge.distanceMin)
            .distanceMax(this.forceProperties.charge.distanceMax);
        this.simulation.force("collide")
            .strength(this.forceProperties.collide.strength * this.forceProperties.collide.enabled)
            .radius(this.forceProperties.collide.radius)
            .iterations(this.forceProperties.collide.iterations);
        this.simulation.force("forceX")
            .strength(this.forceProperties.forceX.strength * this.forceProperties.forceX.enabled)
            .x(this.width * this.forceProperties.forceX.x);
        this.simulation.force("forceY")
            .strength(this.forceProperties.forceY.strength * this.forceProperties.forceY.enabled)
            .y(this.height * this.forceProperties.forceY.y);
        this.simulation.force("link")
            .id(function(d) { return d.id; })
            .distance(this.forceProperties.link.distance)
            .iterations(this.forceProperties.link.iterations)
            .links(this.forceProperties.link.enabled ? this.limitedLinks : []);
    
        // updates ignored until this is run
        // restarts the simulation (important if simulation has already slowed down)
        this.simulation.alpha(1).restart();
    }

    processData() {
        const hashtags = {};
        const links = [];

        // Create nodes and links based on hashtags
        this.data.forEach(entry => {
            entry.Hashtags.forEach(tag => {
                if (!hashtags[tag]) {
                    hashtags[tag] = { id: tag, count: 0 };
                }
                hashtags[tag].count++;
            });
            for (let i = 0; i < entry.Hashtags.length; i++) {
                for (let j = i + 1; j < entry.Hashtags.length; j++) {
                    links.push({
                        source: entry.Hashtags[i],
                        target: entry.Hashtags[j],
                        sentiment: entry.Sentiment
                    });
                }
            }
        });

        // Sort hashtags by frequency and limit the number of tags
        const sortedHashtags = Object.values(hashtags).sort((a, b) => b.count - a.count);
        this.nodes = sortedHashtags;
        this.links = links.filter(link =>
            this.nodes.some(node => node.id === link.source) &&
            this.nodes.some(node => node.id === link.target)
        );
    }

    update(maxTags=200, hashtag="") {
        this.args = [maxTags, hashtag];
        this.container.selectAll(".nodes").remove();
        this.container.selectAll(".links").remove();

        if (hashtag) {
            const uniqueNodes = new Set();
            const uniqueLinks = new Set();
        
            const visitedNodes = new Set();
        
            const traverseGraph = (nodeId) => {
                visitedNodes.add(nodeId);
        
                const node = this.nodes.find(node => node.id === nodeId);
                if (node) {
                    uniqueNodes.add(node);
        
                    const connectedLinks = structuredClone(this.links).filter(link => link.source === nodeId || link.target === nodeId);
                    connectedLinks.forEach(link => {
                        uniqueLinks.add(link);
        
                        const connectedNodeId = link.source === nodeId ? link.target : link.source;
    
                        if (!visitedNodes.has(connectedNodeId)) {
                            traverseGraph(connectedNodeId);
                        }
                    });
                }
            };
        
            traverseGraph(hashtag);
        
            this.limitedNodes = [...uniqueNodes];
            this.limitedLinks = [...uniqueLinks];
        }
        else {
            this.limitedNodes = this.nodes.slice(0, maxTags);
            const limitedNodeIds = new Set(this.limitedNodes.map(node => node.id));

            this.limitedLinks = structuredClone(this.links).filter(link =>
                limitedNodeIds.has(link.source) && limitedNodeIds.has(link.target)
            );
        };

        this.link = this.container.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(this.limitedLinks)
            .enter().append("line");

        this.node = this.container.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(this.limitedNodes)
            .enter().append("circle")
            .call(d3.drag()
                .on("start", this.dragstarted.bind(this))
                .on("drag", this.dragged.bind(this))
                .on("end", this.dragended.bind(this)))
        
        this.click = this.node
            .on("click", (event, d) => {
                this.clicked(event, d);
            });

        // node tooltip
        this.node.append("title")
            .text(function (d) { return d.id; });

        this.updateDisplay();
        this.simulation.nodes(this.limitedNodes);
        this.initializeForces();
        this.simulation.on("tick", (event) => {
            this.ticked(event);
        })

        d3.select(window).on("resize", function () {
            console.log(this);
            width = +this.svg.node().getBoundingClientRect().width;
            height = +this.svg.node().getBoundingClientRect().height;
            this.updateForces();
        });
    }

    initializeForces() {
        this.simulation
            .force("link", d3.forceLink())
            .force("charge", d3.forceManyBody())
            .force("collide", d3.forceCollide())
            .force("center", d3.forceCenter())
            .force("forceX", d3.forceX())
            .force("forceY", d3.forceY());
        this.updateForces();
    }

    updateDisplay() {
        const selectedHashtag = this.args[1];
    
        this.node
            .attr("r", d => d.id === selectedHashtag ? this.forceProperties.collide.radius * 2 : this.forceProperties.collide.radius)
            .attr("stroke-width", this.forceProperties.charge.enabled == false ? 0 : Math.abs(this.forceProperties.charge.strength) / 15);
    
        this.link
            .attr("stroke", d => this.getLinkColor(d.sentiment))
            .attr("stroke-width", this.forceProperties.link.enabled ? 1 : .5)
            .attr("opacity", this.forceProperties.link.enabled ? 1 : 0);
    }

    ticked(event) {
        this.link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        this.node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    }

    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.0001);
        d.fx = null;
        d.fy = null;
    }

    getLinkColor(sentiment) {
        const colors = { Positive: "blue", Neutral: "green", Negative: "red" };
        return colors[sentiment];
    }

    clicked(event, d) {
        // Get the clicked node data
        this.args[1] = d.id;
        this.update(...this.args);
    }

    on(eventType, handler) {
        console.log(eventType);
        this.handlers[eventType] = handler;
    }
}
