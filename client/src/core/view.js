const d3 = require('d3');
const _ = require('lodash');
const randomColor = require('randomcolor');

require('./d3_extension/keybinding');
require('./d3_extension/d3-tip.js');
import api from '../api/api.js';
import { prototype } from 'stream';

common.view = (function() {
    var width, height, container_div;
    var outer, vis, outer_background, drag_group, link_group, node_types, plug_svg;
    var x, y, gX, gY, xAxis, yAxis, zoom;
    var node_size = 16;
    var outer_transform = {
        x:0,
        y:0,
        k:1
    };
    
    var lineGenerator;

    var drag_line;
    var temp_link = {sourceUuid:null,targetUuid:null,source:null,target:null,speed:10};
    var activeNodes = [];
    var activeLinks = [];

    var selected_id = [];

    var types = [];
    var node_type = {};

    var color_define = {
        "speed" : {
            "1G":"#008000",
            "10G":"#7CFC00",
            "25G":"#4B0082",
            "100G":"#008080"
        }
    }

    function canvasContextMenu() {
        var x = (d3.event.offsetX - outer_transform.x ) / outer_transform.k;
        var y = (d3.event.offsetY - outer_transform.y ) / outer_transform.k
        var node_info = {
            status:~~(Math.random() * (5 - 0 + 1)) + 0,
            x:x,
            y:y
        }
        common.events.emit('contextmenu', {
            active:true,
            left : d3.event.pageX,
            top : d3.event.pageY,
            params : {
                node_info:node_info,
                node_types:types,
                event:d3.event
            }
        });
        d3.event.stopPropagation();
        d3.event.preventDefault();
    }

    function canvasMouseDown() {
        common.events.emit('contextmenu', {
            active:false,
            x : d3.event.pageX,
            y : d3.event.pageY,
            params : {}
        });
        temp_link = {source:null,target:null};
        if(drag_line) {
            drag_line.remove();
            drag_line = null;
        }
        //selected_id = "";
        redraw();
    }

    function canvasMouseMove() {
        var start_point = temp_link.source ? temp_link.source : temp_link.target;
        var mouse_x = (d3.event.offsetX - outer_transform.x ) / outer_transform.k;
        var mouse_y = (d3.event.offsetY - outer_transform.y ) / outer_transform.k;
        if(start_point) {
            var x1 = temp_link.source ? (start_point.x) : mouse_x;
            var y1 = temp_link.source ? start_point.y : mouse_y;
            var x2 = temp_link.source ? mouse_x : (start_point.x);
            var y2 = temp_link.source ? mouse_y : start_point.y;
            var path_data = lineGenerator([[x1, y1],[x2, y2]])
            if(drag_line) {
                drag_line.attr("d", path_data)
            } else {
                drag_line = drag_group.append("svg:path").attr("class", "drag_line").attr("stroke-width", node_size/4).attr("d", path_data)
            }
        }
    }

    function canvasDblClick() {
        console.log('dbl click!!!');
    };

    function zoomed() {
        outer_transform = d3.event.transform;
        vis.attr("transform", d3.event.transform);
        gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
        gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
        
        //redraw();
    }

    function dragstarted(d) {
        //d3.event.stopPropagation();
        d3.select(this).classed("dragging", true);
        //redraw();
    }
    
    function dragged(d) {
        d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
        redraw();
    }
    
    function dragended(d) {
        d3.select(this).classed("dragging", false);
        //redraw();
    }

    function addNodes(node) {
        activeNodes.push(node);
        redraw();
    }

    var activeDropShadow, activeBlur;

    var dropShadow = {
        'stdDeviation': 2,
        'dx': 0,
        'dy': 0,
        'slope': 0.5,
        'type': 'linear'
    };

    function addDrawDropShadow() {
        activeBlur = 'blur';
        activeDropShadow = 'dropshadow';

        var defs = outer.append('defs')
        var blur_filter = defs.append('filter').attr('id', activeBlur)
        blur_filter.append('feGaussianBlur')
            .attr('in', 'SourceGraphic')
            .attr('stdDeviation', parseInt(dropShadow.stdDeviation))
    
        var filter = defs.append('filter')
                .attr('id', activeDropShadow)
                .attr('filterUnits','userSpaceOnUse');
    
        filter.append('feGaussianBlur')
            .attr('in', 'SourceAlpha')
            .attr('stdDeviation', parseInt(dropShadow.stdDeviation));
    
        filter.append('feOffset')
            .attr('dx', parseInt(dropShadow.dx))
            .attr('dy', parseInt(dropShadow.dy));
    
        var feComponentTransfer = filter.append('feComponentTransfer');
        feComponentTransfer
            .append('feFuncA')
                .attr('type', dropShadow.type)
                .attr('slope', parseFloat(dropShadow.slope));
    
        var feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    }

    function nodeClicked(node, node_info) {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        if(selected_id.includes(node_info.uuid)) {
            selected_id.splice(selected_id.indexOf(node_info.uuid), 1);
        } else {
            selected_id.push(node_info.uuid);
        }
        redraw();
    }

    function portMouseDown(port, node, type) {
        if(d3.event.button === 0) {
            d3.event.stopPropagation();
            d3.event.preventDefault();
            
            temp_link.source = node;
            temp_link.sourceUuid = node.uuid;
        }
    }

    function portMouseUp(port, node, type) {
        temp_link.target = node;
        temp_link.targetUuid = node.uuid;
        
        if(temp_link.sourceUuid && temp_link.targetUuid) {
            temp_link.speed = "5G";
            activeLinks.push(temp_link);
            redraw();
        }
        temp_link = {source:null, sourceUuid:null,targetUuid:null, target:null};
    }

    function portMouseOver(port, node, type) {
        port.classed("port_hovered",true);
    }

    function portMouseOut(port, node, type) {
        port.classed("port_hovered",false);
    }

    function redraw() {
        var node = vis.selectAll(".nodegroup").data(activeNodes, function(d) { return d.uuid });

        node.exit().remove();

        var nodeEnter = node.enter().insert("svg:g")
            .attr("class", "node nodegroup");
        
        // 신규
        nodeEnter.each(function(d,i) {
            var node = d3.select(this);
            node.attr("id",d.uuid)
                .attr("transform", function(d) { return "translate(" + (d.x) + "," + (d.y) + ")"; })
                .style("cursor", "pointer")
                .on('dblclick', function(){
                    var k, kh, kw, x, y;
                    kw = (container_div.clientWidth - container_div.clientWidth/10) / node.w;
                    kh = (container_div.clientHeight - container_div.clientHeight/10) / node.h;
                    k = d3.min([kw,kh])/4;
                    x = container_div.clientWidth / 2 - d.x * k;
                    y = container_div.clientHeight / 2 - d.y * k;
                    var test = d3.zoomIdentity.translate(x,y).scale(k);
                    outer.transition().duration(1200).call(zoom.transform, test)
                })
                .on('click', (function() { var node = d; return function(d,i) { nodeClicked(d3.select(this),node) }})())
                .on('contextmenu', function() {
                    common.events.emit('popup', {
                        name : 'detailNodeModal',
                        params : d
                    });
                    d3.event.stopPropagation();
                    d3.event.preventDefault();
                })
                .on('mouseover', function() {
                    if(outer_transform.k === 1 || true) {
                        var node = d3.select(this);
                        var port = node.select('.port')
                        port.classed('visible',true);
                    }
                })
                .on('mouseout', function() { 
                    var node = d3.select(this);
                    var port = node.select('.port')
                    port.classed('visible',false);
                })
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended))
            node.w = node_size;
            node.h = node_size;
            
            if(d.status !== "ACTIVE") {
                var anim_alarm = node.append("circle")
                                .attr("r", node_size)
                                .attr("fill", "rgba(255,0,0,0)")
                                .style("stroke", "red")
                                .style("stroke-width", 0)
                var anim_alarm2 = node.append("circle")
                                .attr("r", node_size)
                                .attr("fill", "rgba(255,0,0,0)")
                                .style("stroke", "red")
                                .style("stroke-width", 0)
                
                var anim_alarm3 = node.append("circle")
                                .attr("r", node_size)
                                .attr("fill", "rgba(255,0,0,0)")
                                .style("stroke", "red")
                                .style("stroke-width", 0)

                function repeat() {
                    anim_alarm.attr('r', node_size*0.3).attr('opacity', 1).style("stroke-width", 0);
                    anim_alarm.transition()
                                .duration(1000)
                                .attr("r", node_size*1.4)
                                .attr('opacity', 0)
                                .style("stroke-width", 2.5)
                            .on("end", repeat)
                    anim_alarm2.attr('r', node_size*0.6).attr('opacity', 1).style("stroke-width", 0);
                    anim_alarm2.transition()
                                .duration(1000)
                                .attr("r", node_size*1.4)
                                .attr('opacity', 0)
                                .style("stroke-width", 2.5)
                            .on("end", repeat)
                    anim_alarm3.attr('r', node_size*0.9).attr('opacity', 1).style("stroke-width", 0);
                    anim_alarm3.transition()
                                        .duration(1000)
                                        .attr("r", node_size*1.4)
                                        .attr('opacity', 0)
                                        .style("stroke-width", 2.5)
                                    .on("end", repeat)
                }
                
                repeat();
            }

            if(d.ports && d.ports.length > 0) {
                d.node = node.append("rect")
                    .attr('rx', node_size/4)
                    .attr('x', -node_size)
                    .attr('y', -node_size)
                    .attr("width", node_size*2)
                    .attr("height", node_size*2)
                d.inner_port = node.append('g').attr('class', 'inner_port');
                var trans_x = -(node_size*d.ports.length/2);
                var trans_y = -node_size*3;
                if(d.ports.length >= 12) {
                    trans_x = trans_x /2;
                    trans_y = -node_size*4;
                }
                d.inner_port.attr("transform", function(d) { return "translate(" + trans_x + "," + trans_y + ")"; });
            } else {
                d.node = node.append("circle")
                    .attr("r", node_size)
            }
            d.node.style("cursor", "pointer")
                .attr("class", "node")
                .attr("fill",function(d) { return node_type[d.type] ? node_type[d.type].color : 'rgb(166, 187, 207)' })
            
            var icon_url = "/icons/server.svg";
            
            node.append("image").attr("xlink:href", icon_url).attr("x", -node_size/2).attr("y", -node_size/2).attr("width", node_size).attr("height", node_size);
            
            node.append("circle")
                .attr("class", "port")
                .attr("r", node_size/4)
                .attr("fill", function(d) { return '#ddd' })
                .style("cursor", "crosshair")
                .on('mousedown', (function() { var node = d; return function(d,i) { portMouseDown(d3.select(this),node,'output') }})() )
                .on('mouseup', (function() { var node = d; return function(d,i) { portMouseUp(d3.select(this),node,'output') }})() )
                .on('mouseover', (function() { var node = d; return function(d,i) { portMouseOver(d3.select(this),node,'output') }})() )
                .on('mouseout', (function() { var node = d; return function(d,i) { portMouseOut(d3.select(this),node,'output') }})() )

            node.append('svg:text').attr('y', node_size+12).style('stroke', 'none').style("text-anchor", "middle").text(d.name);
        });

        // 갱신
        node.each(function(d,i) {
            var thisNode = d3.select(this);
            
            thisNode.attr("transform", function(d) { return "translate(" + (d.x) + "," + (d.y) + ")"; });
            if(selected_id.includes(d.uuid)) {
                d.node.classed('selected', true)
                d.node.attr('filter', 'url(#' + activeDropShadow + ')' );

                if(d.inner_port) {
                    d.node.attr("fill", '#eaedf1');
                    //d.node.transition().duration(200).attr("width", node_size *(d.ports.length + 1) + (node_size*2));
                    var inner_ports = d.inner_port.selectAll(".inner_port").data(d.ports, function(d) { return d.uuid });
                    inner_ports.exit().remove();
                    var inner_ports_enter = inner_ports.enter().insert("svg:g").attr("class", "inner_port");
                    var standard_num = 0;
                    if(d.ports.length >= 12) {
                        standard_num  = d.ports.length / 2;
                    }
                    inner_ports_enter.each(function(p,k) {
                        var port = d3.select(this);

                        var port_x = node_size * ((p.idx > standard_num ? (p.idx - standard_num) : p.idx) - 1);
                        var port_y = p.idx > standard_num ? node_size/2 : -node_size/2;
                        port.attr("id",d.uuid)
                        port.append("image")
                            .attr("xlink:href", p.status === "UP" ? "/icons/green_plug.svg" : "/icons/black_plug.svg")
                            .attr('x', port_x)
                            .attr('y', port_y)
                            .attr("width", node_size/2).attr("height", node_size/2);
                        port.append('svg:text').attr('x', port_x).attr('y', port_y + 12)
                        .style('stroke', 'none').style('text-anchor', "start").style('font-size', '.2em').text(p.name);
                    })
                }
            } else {
                d.node.classed('selected', false)
                d.node.attr('filter', null );
                if(d.inner_port) {
                    d.node.attr("fill",function(d) { return node_type[d.type] ? node_type[d.type].color : 'rgb(166, 187, 207)' });
                    //d.node.transition().duration(500).attr("width", node_size*2);
                    
                    var inner_ports = d.inner_port.selectAll(".inner_port").data([], function(d) { return d.uuid });
                    inner_ports.exit().remove();
                }
            }
        });

        var link = link_group.selectAll(".link").data(activeLinks, function(d) { return d.sourceUuid+":"+d.targetUuid });

        var linkEnter = link.enter().insert("svg:g")
            .attr("class", "link").on('click', function(d) {
                common.events.emit('popup', {
                    name : 'chartModal',
                    params : d
                });
            })

        linkEnter.each(function(d,i) {
            var l = d3.select(this);
            if(!d.source) d.source = activeNodes.find(function(a) { return a.uuid === d.sourceUuid});
            if(!d.target) d.target = activeNodes.find(function(a) { return a.uuid === d.targetUuid});
            
            if(d.source && d.target) {
                l.append("svg:path").attr("class", "link_background link_path")
                                // .on("click",function(d) {
                                //     if(selected_id.includes(d.sourceUuid+":"+d.targetUuid)) {
                                //         selected_id.splice(selected_id.indexOf(d.sourceUuid+":"+d.targetUuid), 1);
                                //     } else {
                                //         selected_id.push(d.sourceUuid+":"+d.targetUuid);
                                //     }
                                //     redraw();
                                // })
                var link = l.append("svg:path").attr('class', 'link_line link_path');
                l.append("svg:path").attr('class', 'link_anim')
                l.append('svg:text')
                .attr('class', 'speed')
                .attr('x', (d.source.x + d.target.x)/2)
                .attr('y', (d.source.y + d.target.y)/2)
                .style('stroke', 'none').text(d.latency + " ns");
            }
        })
        link.exit().remove();

        var speed_texts = link_group.selectAll('.speed');

        speed_texts.each(function(d,i) {
            var text = d3.select(this);
            var text_width = text.node().getComputedTextLength()
            text.attr('x', (d.source.x + d.target.x)/2 - (text_width/2))
            .attr('y', (d.source.y + d.target.y)/2)
        })

        var links = link_group.selectAll('.link_path')
        links.each(function(d,i) {
            var thisLink = d3.select(this);
            if(d.source && d.target) {
                var id = d.source.uuid + ":" + d.target.uuid;
                var path_data = lineGenerator([[d.source.x, d.source.y],[d.target.x, d.target.y]])
                thisLink.attr("d", path_data).attr("stroke-width", node_size/4).attr('stroke', color_define.speed[d.speed] ? color_define.speed[d.speed] : '#ff7f0e');
                
                if(selected_id.includes(id)) {
                    thisLink.attr('stroke', '#ff7f0e');
                }
                if(selected_id.includes(d.source.uuid) || selected_id.includes(d.target.uuid)) {
                    var result = activeNodes.filter(function(a) {return a.uuid === d.source.uuid || a.uuid === d.target.uuid});
                    result.forEach(function(v,i) {
                        v.node.attr('filter', 'url(#' + activeDropShadow + ')' );
                    })
                }
            }
        })
        var anim_links = link_group.selectAll('.link_anim');
        anim_links.each(function(d,i) {
            if(d.source && d.target) {
                var thisLink = d3.select(this);
                var path_data = lineGenerator([[d.source.x, d.source.y],[d.target.x, d.target.y]])
                thisLink.attr("d", path_data).attr("stroke-width", node_size/4)
                    .attr('stroke', 'rgb(221,221,221)');
                var totalLength = thisLink.node().getTotalLength();
                thisLink.attr("stroke-dasharray", totalLength/8 + " " + totalLength);
                function repeat() {
                    thisLink.attr('stroke-dashoffset', totalLength + (totalLength/4));
                    thisLink.transition()
                        .duration(20000/d.latency)
                        .attr("stroke-dashoffset", totalLength/8)
                    .transition()
                        .duration(20000/d.latency)
                        .attr('stroke-dashoffset', totalLength + (totalLength/4))
                    .on("end", repeat)
                }
                if(d.latency) {
                    repeat();
                }
            }
        })
    }

    function deleteItem() {
        var node_index = activeNodes.findIndex(function(d) {return selected_id.includes(d.uuid) });
        if(node_index >= 0) {
            var remove_index = [];
            var link_length = activeLinks.length;
            for(var i = 0; i < link_length; i++) {
                var d = activeLinks[i];
                if((selected_id.includes(d.source.uuid) || selected_id.includes(d.target.uuid))) {
                    remove_index.push(i);
                }
            }
            activeNodes.splice(node_index, 1);

            remove_index.sort(function(a,b){return b-a});
            remove_index.forEach(function(link_index) {
                activeLinks.splice(link_index, 1);
            })
            redraw();
        }
    }

    function setNodeType(type) {
        var type_size = {width:node_size*2,height:node_size};
        var margin = 5;
        var color_array = randomColor({
            count: type.length,
            hue: 'blue'
        })
        types = type;
        type.forEach(function(d,i) {
            var type_info = d;
            var y = (type_size.height*i) + (margin*i);
            var node_type_rect = node_types.append('rect').attr('rx', 5).attr('x', 0).attr('y', y)
                        .attr('width', type_size.width).attr('height', type_size.height).attr('fill', color_array[i])
                        .style("stroke", "#333")
                        .style("cursor", "pointer");

            node_type_rect.on('click', function(d) {
                            console.log(type_info)
                        })
                        .on('mouseover', function(d) {
                            node_type_rect.style('stroke', '#ff7f0e')
                        })
                        .on('mouseout', function(d) {
                            node_type_rect.style('stroke', '#333')
                        })
            node_types.append("svg:text").attr("x", type_size.width+margin)
                        .attr('y', y+(type_size.height/2)).attr("dy", ".35em").attr("text-anchor","start").text(d.desc);

            node_type[d.name] = {
                color:color_array[i],
                desc:d.desc
            }
        })
    }

    function getNodeType() {
        return types;
    }

    function reload(data) {
        var me = this;
        activeNodes = [];
        activeLinks = [];
        me.redraw();
        if(data && data.activeNodes) activeNodes = data.activeNodes;
        if(data && data.activeLinks) activeLinks = data.activeLinks;
        me.redraw();
    }

    function getNodes () {
        return activeNodes;
    }

    function getLinks () {
        return activeLinks;
    }

    return {
        setMap: function(root, nodes, event) {
            var topology = nodes.topology;
            var underlay = nodes.underlay;
            var overlay = nodes.overlay;
            var isExists = activeNodes.find(function(d) { return d.uuid === root.uuid});
            if(!isExists) {
                var root_x = Math.round((event.offsetX - outer_transform.x) / outer_transform.k);
                var root_y = Math.round((event.offsetY - outer_transform.y) / outer_transform.k);
                root["x"] = root_x;
                root["y"] = root_y;
                root["ctrl_uuid"] = root.uuid;
                root["status"] = "ACTIVE";
                root["type"] = "SDN";
                activeNodes.push(root);

                var count = 0;
                var total_count = Object.keys(underlay).length;
                _.each(underlay, function(data, type) {
                    _.each(data, function(item, index) {
                        var saved_data = topology[item.uuid];
                        console.log(saved_data);
                        var area_width = (container_div.clientWidth/2) / total_count;
                        var x = root_x - (area_width * count) - (area_width/2)
                        var y = root_y + (((index % 2 === 1) ? -node_size : node_size) * Math.ceil(index/2)*3)
                        item["x"] = saved_data ? parseFloat(saved_data.x) : x;
                        item["y"] = saved_data ? parseFloat(saved_data.y) : y;
                        console.log(item.x, item.y);
                        if(!item.x) {
                            console.log(item.uuid);
                        }
                        item["type"] = type;
                        item["ctrl_uuid"] = root.uuid;
                        activeNodes.push(item);
                        if(item.links && item.links.length > 0) {
                            activeLinks = activeLinks.concat(item.links);
                        }
                        var ports = [];
                        _.each(item.ports, function(v,i) {
                            ports.push(v);
                        })
                        item.ports = ports;
                    });
                    count++;
                });

                count = 0;
                total_count = Object.keys(overlay).length;
                _.each(overlay, function(data, type) {
                    _.each(data, function(item, index) {
                        var saved_data = topology[item.uuid];
                        var area_width = (container_div.clientWidth/2) / total_count;
                        var x = root_x + (area_width * count) + (area_width/2)
                        var y = root_y + (((index % 2 === 1) ? -node_size : node_size) * Math.ceil(index/2)*3)
                        item["x"] = saved_data ? parseFloat(saved_data.x) : x;
                        item["y"] = saved_data ? parseFloat(saved_data.y) : y;
                        item["type"] = type;
                        item["ctrl_uuid"] = root.uuid;
                        console.log(item.x, item.y);
                        if(!item.x) {
                            console.log(item.uuid);
                        }
                        activeNodes.push(item);
                        if(item.links && item.links.length > 0) {
                            activeLinks = activeLinks.concat(item.links);
                        }
                        var ports = [];
                        _.each(item.ports, function(v,i) {
                            ports.push(v);
                        })
                        item.ports = ports;
                    });
                    count++;
                })
            }
            redraw();
        },
        clear: function() {
            activeNodes = [];
            activeLinks = [];
            redraw();
        },
        zoom_reset: function(evt) {
            var me = this;
            outer.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
            redraw();
        },
        reload:reload,
        init: function(id) {
            container_div = document.getElementById(id);
            lineGenerator = d3.line().curve(d3.curveCardinal);
            width = container_div.clientWidth;
            height = container_div.clientHeight;
            console.log(types);
            zoom = d3.zoom().on("zoom", zoomed)
            // var drag = d3.drag().on("dragstart")

            function test() {
                console.log('test');
            }
            var keyboard = d3.keybinding()
                            .on('delete', deleteItem)
                            .on('←', test)
                            .on('↑', test)
                            .on('→', test)
                            .on('↓', test);
            
            d3.select('body').call(keyboard);
            outer = d3.select("#" + id)
                        .append("svg:svg")
                        .attr("width", width)
                        .attr("height", height)
                        .attr('preserveAspectRatio', 'xMinYMin')
                        // .attr("pointer-events", "all")
                        // .style("cursor", "crosshair")
                        .call(zoom)
                        .on('dblclick.zoom', null)
                        .on('contextmenu', canvasContextMenu)
                        .on('click', canvasMouseDown)
                        .on('mousemove', canvasMouseMove)
                        .on('dblclick', canvasDblClick)
            

            vis = outer.append("svg:g")

            drag_group = vis.append("g");
            link_group = vis.append("g");

            x = d3.scaleLinear()
                .domain([-1, width + 1])
                .range([-1, width + 1]);

            y = d3.scaleLinear()
                .domain([-1, height + 1])
                .range([-1, height + 1]);

            xAxis = d3.axisBottom(x)
                .ticks((width + 2) / (height + 2) * 20)
                .tickSize(height)
                .tickPadding(8 - height);

            yAxis = d3.axisRight(y)
                .ticks(20)
                .tickSize(width)
                .tickPadding(8 - width);

            gX = outer.append("g")
                .attr("class", "axis axis--x")
                .attr("opacity", ".5")
                .call(xAxis);

            gY = outer.append("g")
                .attr("class", "axis axis--y")
                .attr("opacity", ".5")
                .call(yAxis);

            node_types = outer.append('g').attr('class', 'node_types').attr("transform", function(d) { return "translate(" + 70 + "," + 70 + ")"; })

            addDrawDropShadow();

            common.events.on('onAddNode', addNodes)

            redraw();
        },
        redraw : redraw,
        setNodeType : setNodeType,
        getNodeType : getNodeType,
        addNodes : addNodes,
        getNodes : getNodes,
        getLinks : getLinks,
        uninit: function() {
            outer.remove();
            width;
            height;
            outer, vis, outer_background, drag_group, link_group, node_types;
            x, y, xAxis, yAxis, gX, gY;
            node_size = 16;
            outer_transform = {
                x:0,
                y:0,
                k:1
            };

            drag_line;
            temp_link = {sourceUuid:null,targetUuid:null,source:null,target:null,speed:0};
            activeNodes = [];
            activeLinks = [];
            selected_id;

            node_type = {};

            common.events.off('onAddNode', addNodes);
            redraw();
        }
    }
})()