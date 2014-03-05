app.directive('waterMap', function(){
  function link(scope, el, attr){
    el = el[0]
    var width, height
    var pi = Math.PI
    var max_r = 30
    var svg = d3.select(el).append('svg')
    var zoomGroup = svg.append('g')
    var geography = zoomGroup.append('g')
    var proj = d3.geo.albers()
    var shapefile
    var reservoirs = zoomGroup.append('g').attr('class', 'reservoirs')
      .selectAll('g.reservoir')
    var clickRegions = svg.append('g').attr('class', 'click-region')
    var radiusToArea = function(r){ return Math.PI * Math.pow(r, 2) }
    var areaToRadius = function(area){ return Math.sqrt(area / Math.PI) }

    // aka, [0, 1] -> [0, pi] 
    var capacityScale = d3.scale.linear().range([1, max_r])
    var voronoi = d3.geom.voronoi()
      .x(function(d){ return proj([d.longitude, d.latitude])[0] })
      .y(function(d){ return proj([d.longitude, d.latitude])[1] })
    geography.append('path')

    var points = svg.append('g')
    var coords = []
    var hovered_reservoir = null

    // resize()
    function resize(){
      width = el.clientWidth, height = el.clientHeight
      svg.attr({width: width, height: height})
      proj.translate([ width / 2, height / 2])
        .rotate([117.9, 1.3, 1])
        .scale(3700)
      voronoi.clipExtent([[50, 90], [width / 2, height * 0.9]])
    }
    scope.$watch(function(){ return el.clientWidth + el.clientHeight }, resize)
    scope.$watch('reservoirs', function(data){
      if(!data || !data.length) return
      var max = d3.max(data, function(d){ return Number(d.capacity) })
      capacityScale.domain([0, max])
      reservoirs = reservoirs.data(data, function(d){ return d.id })
      reservoirs.exit().remove()
      var reservoir = reservoirs.enter().append('g')
        .attr('class', 'reservoir')
        .attr('transform', function(d){
          return 'translate(' + proj([d.longitude, d.latitude]) + ')' 
        }).append('g').attr('class', 'scale')
          .call(set_reservoir_scale, function(d){
            // console.log('d', d)
            return capacityScale(d.capacity)
          })
      reservoir.append('circle')
        .attr('class', 'capacity')
        .attr('r', function(d){ return areaToRadius(pi) })
      reservoir.append('circle').attr('class', 'level')
      var join = clickRegions.selectAll('path').data(voronoi(data))
      join.exit().remove()
      join.enter().append('path')
      var poly = [[211.5,102],[388.5,492],[323.5,599],[201.5,563],[42.5,258],[62.5,101]].reverse()
      poly = d3.geom.polygon(poly)
      join.style('fill', function(d, i){ return 'rgba(0, 0, 0, 0)' })
        .style('stroke', 'none')
        .attr('d', function(d){
          return 'M' + d3.geom.polygon(poly).clip(d).join('L') + 'Z' 
        })
        .on('click', function(d, i){
          first_active = true
          shrink_hovered_reservoir()
          scope.$apply(function(){ scope.selectedReservoir = data[i] })
        })
        .on('mouseover', function(_, i){
          if(first_active) return set_hovered_reservoir(data[i])
          shrink_hovered_reservoir()
          scope.$apply(function(){ scope.selectedReservoir = data[i] })
        })
      clickRegions.on('mouseout', function(){
        shrink_hovered_reservoir()
        first_active = true
      })
    })

    var first_active = false

    function shrink_hovered_reservoir(){
      if(!hovered_reservoir) return
      var el = d3.select(hovered_reservoir)
      var d = el.datum()
      el.classed('hover', false).select('.scale')
        .call(set_reservoir_scale, capacityScale(d.capacity))
    }

    function set_hovered_reservoir(d){
      shrink_hovered_reservoir()
      var el = reservoir_el_given_d(d)
      d3.select(el).classed('hover', true).select('.scale')
        .call(set_reservoir_scale, 100)
      // replace old hovered reservoir
      hovered_reservoir = el
      // sort the reservoirs so that the hovered reservoir is on top
      reservoirs.sort(function(a, b){
        return a === d ? 1 : 0 - b === d ? 1 : 0 })
    }
  
    function set_reservoir_scale(g_scale, scale){
      g_scale.transition().attr('transform', function(d){
        var _scale
        if(scale instanceof Function) _scale = scale(d)
        else _scale = scale
        return 'scale(' + _scale + ')'
      })
    }

    scope.$watch('history', draw_levels)

    scope.$watch('now', draw_levels)

    function draw_levels(){
      if(scope.history === undefined || scope.now === undefined) return
      if(!scope.history.length) return
      reservoirs.select('.level')
        .transition().duration(500)
        .ease('linear')
        .attr('r', function(d){
          var val = scope.history[scope.now].reservoirs[d.id] || 0
          var ratio = val / d.capacity
          return areaToRadius(ratio * pi)
        })
    }

    scope.$watch('shapefile', update_shapefile)
    function update_shapefile(_){
      if(!_) return
      shapefile = _
      var shape = topojson.feature(shapefile, shapefile.objects.counties)
      window.shape = shape
      geography.select('path')
        .datum(shape)
        .attr('d', d3.geo.path().projection(proj))
    }

    var prev_el, in_transit = false
    function update_selected_reservoir(d){
      if(!d) return
      var el = reservoir_el_given_d(d)
      // if(in_transit) return // we're already getting a new reservoir
      if(el === prev_el) return
      in_transit = true
      scope.selectedReservoir = d
      d3.select(el).transition()
        .attr('transform', 'translate(' + [300, 150] + ')')
        .each('end', function(){ in_transit = false })
      if(prev_el) d3.select(prev_el).transition().attr('transform', function(d){
        return 'translate(' + proj([d.longitude, d.latitude]) + ')' 
      })
      prev_el = el
    }

    function reservoir_el_given_d(d){
      return reservoirs.filter(function(d_){ return d_ === d }).node()
    }

    scope.$watch('selectedReservoir', update_selected_reservoir)

  }
  return {
      link: link
    , restrict: 'E'
    , scope: {
        reservoirs: '='
      , shapefile: '='
      , history: '='
      , now: '='
      , selectedReservoir: '='
    }
  }
})