// @flow
import React from 'react';
import isEqual from 'lodash.isequal';

import {synchronizeLayoutWithChildren, validateLayout} from './utils';
import {getBreakpointFromWidth, getColsFromBreakpoint, findOrGenerateResponsiveLayout} from './responsiveUtils';
import ReactGridLayout from './ReactGridLayout';

const noop = function(){};

import type {Layout} from './utils';
type State = {
  layout: Layout,
  breakpoint: string,
  cols: number
};

export default class ResponsiveReactGridLayout extends React.Component {

  // This should only include propTypes needed in this code; RGL itself
  // will do validation of the rest props passed to it.
  static propTypes = {

    //
    // Basic props
    //

    // Optional, but if you are managing width yourself you may want to set the breakpoint
    // yourself as well.
    breakpoint: React.PropTypes.string,

    // {name: pxVal}, e.g. {lg: 1200, md: 996, sm: 768, xs: 480}
    breakpoints: React.PropTypes.object,

    // # of cols. This is a breakpoint -> cols map
    cols: React.PropTypes.object,

    // layouts is an object mapping breakpoints to layouts.
    // e.g. {lg: Layout, md: Layout, ...}
    layouts: function (props) {
      React.PropTypes.object.isRequired.apply(this, arguments);
      Object.keys(props.layouts).forEach((key) => validateLayout(props.layouts[key], 'layouts.' + key));
    },

    // The width of this component.
    // Required in this propTypes stanza because generateInitialState() will fail without it.
    width: React.PropTypes.number.isRequired,

    //
    // Callbacks
    //

    // Calls back with breakpoint and new # cols
    onBreakpointChange: React.PropTypes.func,

    // Callback so you can save the layout.
    // Calls back with (currentLayout, allLayouts). allLayouts are keyed by breakpoint.
    onLayoutChange: React.PropTypes.func,

    // Calls back with (containerWidth, margin, cols)
    onWidthChange: React.PropTypes.func
  };

  static defaultProps = {
    breakpoints: {lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0},
    cols: {lg: 12, md: 10, sm: 6, xs: 4, xxs: 2},
    layouts: {},
    onBreakpointChange: noop,
    onLayoutChange: noop,
    onWidthChange: noop,
  };

  state: State = this.generateInitialState();

  generateInitialState(): State {
    const {width, breakpoints, layouts, verticalCompact, cols} = this.props;
    const breakpoint = getBreakpointFromWidth(breakpoints, width);
    const colNo = getColsFromBreakpoint(breakpoint, cols);
    // Get the initial layout. This can tricky; we try to generate one however possible if one doesn't exist
    // for this layout.
    const initialLayout = findOrGenerateResponsiveLayout(layouts, breakpoints, breakpoint,
                                                         breakpoint, colNo, verticalCompact);

    return {
      layout: initialLayout,
      breakpoint: breakpoint,
      cols: colNo
    };
  }

  componentWillReceiveProps(nextProps: Object) {

    if (nextProps.width != this.props.width) {
      const newBreakpoint = nextProps.breakpoint || getBreakpointFromWidth(nextProps.breakpoints, nextProps.width);
      this.onWidthChange(nextProps.width, newBreakpoint);
    }

    // Allow parent to set breakpoint directly.
    if (nextProps.breakpoint !== this.props.breakpoint) {
      this.onWidthChange(nextProps.width, nextProps.breakpoint);
    }

    // Allow parent to set layouts directly.
    if (!isEqual(nextProps.layouts, this.props.layouts)) {
      const {breakpoint, cols} = this.state;

      // Since we're setting an entirely new layout object, we must generate a new responsive layout
      // if one does not exist.
      const newLayout = findOrGenerateResponsiveLayout(
        nextProps.layouts, nextProps.breakpoints,
        breakpoint, breakpoint, cols, nextProps.verticalLayout
      );
      this.setState({layout: newLayout});
    }
  }

  /**
   * When the width changes work through breakpoints and reset state with the new width & breakpoint.
   * Width changes are necessary to figure out the widget widths.
   */
  onWidthChange(width: number, newBreakpoint: string) {
    const {breakpoints, verticalLayout, verticalCompact, cols} = this.props;

    const lastBreakpoint = this.state.breakpoint;

    // Breakpoint change
    if (lastBreakpoint !== newBreakpoint) {

      // Store the current layout
      const layouts = this.props.layouts;
      layouts[lastBreakpoint] = JSON.parse(JSON.stringify(this.state.layout));

      // Find or generate a new one.
      const newCols: number = getColsFromBreakpoint(newBreakpoint, cols);
      let layout = findOrGenerateResponsiveLayout(layouts, breakpoints, newBreakpoint,
                                                  lastBreakpoint, newCols, verticalLayout);

      // This adds missing items.
      layout = synchronizeLayoutWithChildren(layout, this.props.children, newCols, verticalCompact);

      // Store this new layout as well.
      layouts[newBreakpoint] = layout;

      // callbacks
      this.props.onLayoutChange(layout, layouts);
      this.props.onBreakpointChange(newBreakpoint, newCols);
      this.props.onWidthChange(width, this.props.margin, newCols);

      this.setState({breakpoint: newBreakpoint, layout: layout, cols: newCols});
    }
  }

  render(): ReactElement {
    const {breakpoint, breakpoints, cols, layouts, onBreakpointChange,
           onLayoutChange, onWidthChange, ...other} = this.props;

    // wrap layouts so we do not need to pass layouts to child
    const onLayoutChangeWrapper = layout => onLayoutChange(layout, layouts);

    return (
      <ReactGridLayout
        {...other}
        onLayoutChange={onLayoutChangeWrapper}
        layout={this.state.layout}
        cols={this.state.cols}
      />
    );
  }
}
