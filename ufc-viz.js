var fighters = {};
var weightClasses = ["Atomweight", "Strawweight", "Flyweight",
					 "Bantamweight", "Featherweight", "Lightweight",
					 "Welterweight", "Middleweight", "Light Heavyweight",
					 "Heavyweight", "Super Heavyweight"];

var weightDescriptions = {};
weightDescriptions["Atomweight"] = "<105 lb (women only)";
weightDescriptions["Strawweight"] = "<115 lb";
weightDescriptions["Flyweight"] = "115-125 lb";
weightDescriptions["Bantamweight"] = "125-135 lb";
weightDescriptions["Featherweight"] = "135-145 lb";
weightDescriptions["Lightweight"] = "145-155 lb";
weightDescriptions["Welterweight"] = "155-170 lb";
weightDescriptions["Middleweight"] = "170-185 lb";
weightDescriptions["Light Heavyweight"] = "185-205 lb";
weightDescriptions["Heavyweight"] = "205-265 lb";
weightDescriptions["Super Heavyweight"] = ">265 lb";

var MIN_FIGHT_COUNT = 10;

var width = window.innerWidth - 100
var height = window.innerHeight - 100;

function getXForWeightClass(weightClass) {
	var i = weightClasses.indexOf(weightClass);

	if(i === -1) return -1;

	return width / weightClasses.length * (i + .5);
}

d3.csv("fighters.csv", function(data) {
	// Load all fighter data into memory
	for(var i = 0; i < data.length; i++) {
		var id = data[i]["fid"];
		var name = data[i]["name"];
		var wClass = data[i]["class"];
		var fightList = [];

		if(weightClasses.indexOf(wClass) > -1) {
			fighters[id] = {
				id: id,
				name: name,
				wClass: wClass,
				fightList: fightList,
			};
		}
		else {
			console.log("Unknown weight class '" + wClass + "' for fighter " + name + " (" + id + ") ... Ignoring fighter.");
		}
	}

	// Now that fighters are loaded into memory,
	// read all of the fight data
	d3.csv("fights.csv", function(data) {
		for(var i = 0; i < data.length; i++) {
			var fight = data[i];
			var id1 = fight["f1fid"];
			var id2 = fight["f2fid"];
			var name1 = fight["f1name"];
			var name2 = fight["f2name"];
			var result1 = fight["f1result"];
			var result2 = fight["f2result"];
			
			if(id1 in fighters && id2 in fighters) {
				if(result1 == "win" || result2 == "win")
				{
					fighters[id1].fightList.push(
						{
							opponentName: name2,
							opponentId: id2,
							result: result1
						}
					);

					fighters[id2].fightList.push(
						{
							opponentName: name1,
							opponentId: id1,
							result: result2
						}
					);
				}
				else {
					console.log("Fight didn't result in win/loss (results: " + result1 + "/" + result2 + ") ... Ignoring fight.");
				}
			}
			else {
				if (!(id1 in fighters)) {
					console.log("Couldn't identify fighter " + name1 + "(" + id1 + ") ... Ignoring fight.");
				}
				if (!(id2 in fighters)) {
					console.log("Couldn't identify fighter " + name2 + "(" + id2 + ") ... Ignoring fight.");
				}
			}
		}

		// Now that fight data is loaded into memory, remove any fighters
		// that have < MIN_FIGHT_COUNT
		{
			var removeList = [];
			
			for(var id in fighters) {
				var fighter = fighters[id];

				if(fighter.fightList.length < MIN_FIGHT_COUNT) {
					removeList.push(id);
				}
			}

			for(var i = 0; i < removeList.length; i++) {
				var removeId = removeList[i];
				delete fighters[removeId];
			}

			console.log("Removed " + removeList.length + " fighters for having < " + MIN_FIGHT_COUNT + " fights ... " + Object.keys(fighters).length + " fighters remain.");
		}

		// Remove any of the unrepresented weight classes from our master list
		// so that we don't draw labels, etc. for them
		{
			var countPerWeightClass = {};
			for(var i = 0; i < weightClasses.length; i++) {
				countPerWeightClass[weightClasses[i]] = 0;
			}
			
			for(var id in fighters) {
				var fighter = fighters[id];
				countPerWeightClass[fighter.wClass] += 1;
			}

			for(var i = 0; i < weightClasses.length; i++) {
				if(countPerWeightClass[weightClasses[i]] === 0) {
					console.log("Removed weight class " + weightClasses[i] + " for having 0 fighters in it after filtering.");
					weightClasses.splice(i, 1); // remove i'th index
					i--; // decrement i to avoid skipping next element
				}
			}
		}

		// Cache win % for each fighter
		for(var id in fighters) {
			var fighter = fighters[id];
			var winCount = 0;
			

			for(var i = 0; i < fighter.fightList.length; i++) {
				var fight = fighter.fightList[i];

				if(fight.result === "win") {
					winCount += 1;
				}
			}

			fighter.winPercent = winCount / fighter.fightList.length;
		}

		// Create list of all the links
		var links = [];
		var maxHead2HeadCount = 1;
		
		for(var id in fighters) {
			var fighter = fighters[id];

			// Keep a list of who we've already linked
			// so duplicate fights won't create a second link
			myLinkedOpponents = [];
			myLinks = [];

			for(var i = 0; i < fighter.fightList.length; i++) {
				var fight = fighter.fightList[i];

				if(!(fight.opponentId in fighters)) {
					continue;
				}
				
				// only create link if your name comes first alphabetically,
				// so we don't create duplicate links
				if(id < fight.opponentId) {
					var index = myLinkedOpponents.indexOf(fight.opponentId);
					if(index === -1) {
						var newLink = {
								source: id,
								target: fight.opponentId,
								count: 1
						};
						
						links.push(newLink);

						// myLinkedOpponents and myLinks must have parallel indices
						myLinkedOpponents.push(fight.opponentId);
						myLinks.push(newLink);
					}
					else {
						myLinks[index].count += 1;
						maxHead2HeadCount = Math.max(maxHead2HeadCount, myLinks[index].count);
					}
				}
			}
		}
		
		//
		// This function completely scratches whatever is currently
		// on the svg and rebuilds the network graphic from scratch
		//
		// wClasses - a list of strings describing which weight classes to include.
		//            null means include all of the weight classes.
		//
		// focusFighter1 - the ID of the fighter who is being "focused" on (via
		//                 clicking on a node), or the ID of the first of two
		//                 fighters that are being "focused" on (via clicking on
		//                 a link). If no node or link is in focus, this param
		//                 is null.
		//
		// focusFighter2 - the ID of the second of two fighters that are being
		//                 "focused" on (via clicking a link). If no link is
		//                 in focus, this param is null
		//
		function createInfoViz(wClasses, focusFighter1, focusFighter2) {
			// (Map our fighter dict into a list)
			var nodes = [];

			for(var id in fighters) {
				nodes.push(fighters[id]);
			}
			
			var svg = d3.select(".chart").append("svg")
				.attr("width", width)
				.attr("height", height)
				.attr("class", "svg");

			var color = d3.scaleOrdinal(d3.schemeCategory20);

			var simulation = d3.forceSimulation()
				.nodes(nodes)
				.on("tick", ticked)
				.force("link",
					   // This force attracts nodes that are connected
					   d3.forceLink()
					   .links(links)
					   .id(function(d) {
						   return d.id;
					   })
					   .distance(function(d) {
				   		   var dist = 1;
				   		   var weightClassDifference = Math.abs(
				   			   weightClasses.indexOf(d.source.wClass) - weightClasses.indexOf(d.target.wClass));
						   
				   		   dist += weightClassDifference;

				   		   dist *= 100;
						   
				   		   return dist;
					   })
					   .strength(function(d) {
				   		   var str = 1;
				   		   var weightClassDifference = Math.abs(
				   			   weightClasses.indexOf(d.source.wClass) - weightClasses.indexOf(d.target.wClass));
						   
				   		   str += weightClassDifference;

				   		   str *= .5;
						   
				   		   return str;
					   })
					  )
				.force(
					// This force repels nodes away from each other
					"charge",
					d3.forceManyBody()
						.distanceMax(300)
				)
				.force(
					// This force centers the network as a whole around the center of the screen
					"center",
					d3.forceCenter()
						.x(width / 2)
						.y(height / 2)
				)
				.force(
					// This force should position the lighter weight clusters to the left and
					// heavier ones to the right
					"xPosForce",
					d3.forceX(function(d) {
						var result = getXForWeightClass(d.wClass);
						return result;
					})
				);

			var link = svg.append("g")
				.attr("class", "link")
				.selectAll("line")
				.data(links)
				.enter().append("line")
				.attr("stroke-width", function(d) {
					return 2;
				})
				.attr("opacity", function(d) {
					var result = .05 + .95 * (d.count / maxHead2HeadCount);
					return result;
				});

			var node = svg.append("g")
				.attr("class", "node")
				.selectAll("nodes")
				.data(nodes)
				.enter().append("g");

			node.append("circle")
				.attr("r", function(d) {
					return 1 + 10 * d.winPercent;
				})
				.attr("fill", function(d) {
					return color(weightClasses.indexOf(d.wClass));
				})

			// node.append("text")
			// 	.text(function(d) { return d.name });

			function ticked() {
				function clampX(value) { return Math.min(Math.max(value, 50), width - 50); }
				function clampY(value) { return Math.min(Math.max(value, 50), height - 50); }
				
				node.selectAll("circle")
					.attr("cx", function(d) { return clampX(d.x); })
					.attr("cy", function(d) { return clampY(d.y); });

				// node.selectAll("text")
				// 	.attr("x", function(d) { return d.x; })
				// 	.attr("y", function(d) { return d.y; });

				link
					.attr("x1", function(d) { return clampX(d.source.x); })
					.attr("y1", function(d) { return clampY(d.source.y); })
					.attr("x2", function(d) { return clampX(d.target.x); })
					.attr("y2", function(d) { return clampY(d.target.y); });
			}

			// Create tooltip for hovering over weight class labels
			var wClassTooltip = d3.select(".chart").append("div");
			wClassTooltip.attr("class", "tooltip")
				.style("opacity", 0);

			// Create weight class labels
			for(var i = 0; i < weightClasses.length; i++) {
				var wClass = weightClasses[i];
				
				svg.append("text")
					.attr("x", getXForWeightClass(wClass))
					.attr("y", function() {
						if(i % 2 === 0) {
							return 30;
						}
						else {
							return 80;
						}
					})
					.attr("text-anchor", "middle")
					.attr("font-size", 30)
					.attr("fill", color(i))
					.attr("font-family", "Arial")
					.attr("cursor", "default")
					.text(wClass)
					.on("mousemove", (function(closureValue) {
						// extremely overly complicated way of capturing wClass
						// at the time we create the handler function. javascript :(
						return function() {
							var htmlString = weightDescriptions[closureValue] + "<br>" + countPerWeightClass[closureValue] + " fighters";
							
							wClassTooltip.transition()
								.duration(100)
								.style("opacity", 1);

							wClassTooltip.html(htmlString)
								.style("left", (d3.event.pageX) + "px")
								.style("top", (d3.event.pageY + 20) + "px");

							d3.selectAll(".node circle")
								.transition()
								.duration(200)
								.style("stroke", function(d) {
									if(d.wClass === closureValue) {
										return "#000000"; 
									}
									else {
										return "#FFFFFF";
									}
								})
						}
					})(wClass))
					.on("mouseout", function() {
						wClassTooltip.transition()
							.duration(100)
							.style("opacity", 0);

						d3.selectAll(".node circle")
							.transition()
							.duration(200)
							.style("stroke", "#FFFFFF")
					});
			}
		}

		createInfoViz(null, null, null);
	});
});
