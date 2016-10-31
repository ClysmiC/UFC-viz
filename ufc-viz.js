var fighters = {};
var weightClasses = ["Atomweight", "Strawweight", "Flyweight",
					 "Bantamweight", "Featherweight", "Lightweight",
					 "Welterweight", "Middleweight", "Light Heavyweight",
					 "Heavyweight", "Super Heavyweight"];

var MIN_FIGHT_COUNT = 12;

d3.csv("fighters.csv", function(data) {
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

		// Create list of all the links
		var links = [];
		
		for(var id in fighters) {
			var fighter = fighters[id];

			// Keep a list of who we've already linked
			// so duplicate fights won't create a second link
			linkedOpponents = [];

			for(var i = 0; i < fighter.fightList.length; i++) {
				var fight = fighter.fightList[i];

				if(!(fight.opponentId in fighters)) {
					continue;
				}
				
				// only create link if your name comes first alphabetically,
				// so we don't create duplicate links
				if(id < fight.opponentId) {
					if(linkedOpponents.indexOf(fight.opponentId) == -1) {
						links.push(
							{
								source: id,
								target: fight.opponentId,
								value: 1
							}
						)

						linkedOpponents.push(fight.opponentId);
					}
				}
			}
		}

		// (Map our fighter dict into a list)
		var nodes = [];
		for(var id in fighters) {
			nodes.push(fighters[id]);
		}
		
		//
		// Now, construct the network!
		
		var width = 960,
			height = 800

		var svg = d3.select("body").append("svg")
			.attr("width", width)
			.attr("height", height);

		var color = d3.scaleOrdinal(d3.schemeCategory20);

		var simulation = d3.forceSimulation()
			.force("link", d3.forceLink().id(function(d) {
				return d.id;
			}))
			.force("charge", d3.forceManyBody())
			.force("center", d3.forceCenter(width / 2, height / 2));

		var link = svg.append("g")
			.attr("class", "links")
			.selectAll("line")
			.data(links)
			.enter().append("line")
			.attr("stroke-width", function(d) { return 2; });

		var node = svg.append("g")
			.attr("class", "nodes")
			.selectAll("nodes")
			.data(nodes)
			.enter().append("g");

		node.append("circle")
			.attr("r", 5)
			.attr("fill", function(d) {
				return color(weightClasses.indexOf(d.wClass));
			})

		// node.append("text")
		// 	.text(function(d) { return d.name });

		simulation
			.nodes(nodes)
			.on("tick", ticked);

		simulation.force("link")
			.links(links);

		function ticked() {
			link
				.attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });

			node.selectAll("circle")
				.attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });

			node.selectAll("text")
				.attr("x", function(d) { return d.x; })
				.attr("y", function(d) { return d.y; });	  
		}
	});
});
