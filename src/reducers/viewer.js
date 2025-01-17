import Immutable from 'immutable';
import { getNeuroglancerViewerState } from '@janelia-flyem/react-neuroglancer';

import C from './constants';

const viewerState = Immutable.Map({
  ngState: {
    // The dimensions must be specified explicitly to keen Neuroglancer from applying a
    // transformation to the `projectionScale` and `crossSectionScale`.
    dimensions: {
      x: [8e-9, 'm'],
      y: [8e-9, 'm'],
      z: [8e-9, 'm'],
    },
    // For fun, start zoomed out so the whole hemi-brain is visible.
    crossSectionScale: 100,
    position: [17000, 20175, 21000],
    // The "legacy" form of Neuroglancer view state 'layers' as a map, with layer names as keys.
    // But when Neuroglancer returns its current state, it returns 'layers' as an array.
    layers: [
      {
        name: 'grayscale',
        type: 'image',
        source: '',
      },
      {
        name: 'segmentation',
        type: 'segmentation',
        source: '',
        segmentColors: {},
      },
    ],
    projectionScale: 2600,
    showSlices: false,
    layout: '4panel', // 'xz-3d',
  },
});

let syncStateNeeded = false;

export const setSyncStateNeeded = (needed) => {
  syncStateNeeded = needed;
};

const syncedState = (state) => {
  if (syncStateNeeded) {
    const ngState = getNeuroglancerViewerState();
    syncStateNeeded = false;

    // For some reason, the state returned by Neuroglancer is missing `dimensions`
    // in some cases, which adversely affects the value of `projectionScale`.
    // This is caused by layer update, which resets the global coordinate space
    // temporarily when clearing up the layers in an intermediate step.
    if (ngState.dimensions === undefined) {
      ngState.dimensions = JSON.parse(JSON.stringify(state.getIn(['ngState', 'dimensions'])));
      // When `dimensions` is missing, then `crossSectionScale` seems to have a
      // bogus value.
      // 'projectionScale' has the same issue.
      // Simply removing the unreliable fields should be good enough to solve the problem.
      delete ngState.crossSectionScale;
      delete ngState.projectionScale;
    }

    // Clear up undefined layer selection to make sure that the state is valid for Neuroglancer.
    // This problem is caused by the way of handling states in Neuroglancer.
    // The state JSON obtained from Neuroglancer may be rejected by Neuroglancer itself.
    if (ngState.selection && ngState.selection.layers) {
      Object.keys(ngState.selection.layers).forEach((layerName) => {
        if (ngState.selection.layers[layerName] === undefined) {
          delete ngState.selection.layers[layerName];
        }
      });
    }

    return state.set('ngState', ngState);
  }
  return state;
};

const setInLayerArray = (state, layerName, propPathArray, propValue, adding) => {
  const layers = state.getIn(['ngState', 'layers']);
  let i = layers.findIndex((value) => (value.name.includes(layerName)));
  if (i === -1) {
    i = layers.findIndex((value) => (value.type.includes(layerName)));
  }
  if ((i === -1) && adding) {
    i = layers.length;
  }
  if (i === -1) {
    return state;
  }
  return state.setIn(['ngState', 'layers', i, ...propPathArray], propValue);
};

const hasLayer = (state, layerName) => {
  const layers = state.getIn(['ngState', 'layers']);
  const i = layers.findIndex((value) => (value.name === layerName));

  return i !== -1;
};

const getInLayerArray = (state, layerName, propPathArray) => {
  const layers = state.getIn(['ngState', 'layers']);
  const i = layers.findIndex((value) => (value.name === layerName));
  if (i === -1) {
    return undefined;
  }
  return state.getIn(['ngState', 'layers', i, ...propPathArray]);
};

function isEquivalenceChanged(equivalences, currentEquivalences) {
  if (equivalences.length === 0 || currentEquivalences.length === 0) {
    return equivalences.length !== currentEquivalences.length;
  }

  const edgeCount1 = equivalences.reduce((result, a) => result + a.length - 1, 0);
  const edgeCount2 = currentEquivalences.reduce((result, a) => result + a.length - 1, 0);
  if (edgeCount1 !== edgeCount2) {
    return true;
  }

  // Assumptions:
  //   1. Components in equivalences are isolated
  //   2. currentEquivalences only contains non-redundant pairwise equivalences
  return !currentEquivalences.every(
    (pair) => equivalences.some(
      (group) => group.includes(parseInt(pair[0], 10)) && group.includes(parseInt(pair[1], 10)),
    ),
  );
}

function isSegmentColorChanged(segmentColors, currentSegmentColors) {
  if (Object.keys(segmentColors).length === Object.keys(currentSegmentColors).length) {
    return Object.keys(segmentColors).some(
      (key) => segmentColors[key] !== currentSegmentColors[key],
    );
  }

  return true;
}

export default function viewerReducer(state = viewerState, action) {
  switch (action.type) {
    case C.VIEWER_RESET: {
      return viewerState;
    }
    case C.INIT_VIEWER: {
      syncStateNeeded = false;
      return state.set('ngState', action.payload);
    }
    case C.SYNC_VIEWER: {
      return syncedState(state);
    }
    case C.SET_VIEWER_GRAYSCALE_SOURCE: {
      return setInLayerArray(syncedState(state), 'grayscale', ['source'], action.payload);
    }
    case C.SET_VIEWER_LAYER_SOURCE: {
      const { layerName, source } = action.payload;
      if (hasLayer(state, layerName)) {
        let newSource = source;
        if (typeof source === 'function') {
          newSource = source(getInLayerArray(state, layerName, ['source']));
        }
        return setInLayerArray(syncedState(state), layerName, ['source'], newSource);
      }

      return syncedState(state);
    }
    case C.SET_VIEWER_SEGMENTATION_SOURCE: {
      return setInLayerArray(syncedState(state), 'segmentation', ['source'], action.payload);
    }
    case C.SET_VIEWER_SEGMENTATION_LAYER_NAME: {
      return setInLayerArray(syncedState(state), 'segmentation', ['name'], action.payload);
    }
    case C.SET_VIEWER_SEGMENT_QUERY: {
      return setInLayerArray(syncedState(state), 'segmentation', ['segmentQuery'], action.payload);
    }
    case C.SET_VIEWER_TODOS_SOURCE: {
      return setInLayerArray(syncedState(state), 'todos', ['source'], action.payload);
    }
    case C.SET_VIEWER_TODOS_TYPE: {
      return setInLayerArray(syncedState(state), 'todos', ['defaultAnnotationProperties', 'point', 'type'], action.payload);
    }
    case C.SET_VIEWER_TODOS_HINT: {
      return setInLayerArray(syncedState(state), 'todos', ['defaultAnnotationProperties', 'point', 'hint'], action.payload);
    }
    case C.SET_VIEWER_ANNOTATION_SELECTION: {
      if (action.payload.host === 'viewer') {
        const newState = syncedState(state);
        let selection = newState.getIn(['ngState', 'selection']);
        if (!selection) {
          selection = {};
        }
        if (!selection.layers) {
          selection.layers = {};
        }

        selection.layers[action.payload.layerName] = {
          annotationId: action.payload.annotationId,
        };

        return newState.setIn(
          ['ngState', 'selection'], selection,
        );
      }
      return setInLayerArray(syncedState(state), action.payload.layerName, ['selectedAnnotation'], { id: action.payload.annotationId });
    }
    case C.SET_VIEWER_ANNOTATION_TOOL: {
      return setInLayerArray(syncedState(state), action.payload.layerName, ['tool'], action.payload.annotationTool);
    }
    case C.SET_VIEWER_SEGMENTS: {
      const layerName = action.payload.layerName || 'segmentation';
      const segments = action.payload.segments || action.payload;
      return setInLayerArray(syncedState(state), layerName, ['segments'], segments);
    }
    case C.SET_VIEWER_SEGMENT_COLORS: {
      const layerName = action.payload.layerName || 'segmentation';
      let segmentColors = action.payload.segmentColors || action.payload;
      const currentState = syncedState(state);
      const currentSegmentColors = getInLayerArray(currentState, layerName, ['segmentColors']);
      if (isSegmentColorChanged(segmentColors || {}, currentSegmentColors || {})) {
        if (action.payload.mode === 'append') {
          if (currentSegmentColors) {
            segmentColors = { ...currentSegmentColors, ...segmentColors };
          }
        }
        return setInLayerArray(currentState, layerName, ['segmentColors'], segmentColors);
      }
      return currentState;
    }
    case C.SET_VIEWER_SEGMENT_EQUIVALENCES: {
      const layerName = action.payload.layerName || 'segmentation';
      const equivalences = action.payload.equivalences || action.payload;
      const currentState = syncedState(state);
      const currentEquivalences = getInLayerArray(currentState, layerName, ['equivalences']);
      const changed = isEquivalenceChanged(equivalences || [], currentEquivalences || []);
      return changed ? setInLayerArray(currentState, layerName, ['equivalences'], equivalences) : currentState;
    }
    case C.SET_VIEWER_CROSS_SECTION_SCALE: {
      return (syncedState(state).setIn(['ngState', 'crossSectionScale'], action.payload));
    }
    case C.SET_VIEWER_CAMERA_POSITION: {
      return (syncedState(state).setIn(['ngState', 'position'], action.payload));
    }
    case C.SET_VIEWER_CAMERA_PROJECTION_SCALE: {
      return (syncedState(state).setIn(['ngState', 'projectionScale'], action.payload));
    }
    case C.SET_VIEWER_CAMERA_PROJECTION_ORIENTATION: {
      return (syncedState(state).setIn(['ngState', 'projectionOrientation'], action.payload));
    }
    case C.ADD_VIEWER_LAYER: {
      const { name } = action.payload;
      return setInLayerArray(syncedState(state), name, [], action.payload, true);
    }
    case C.SELECT_VIEWER_LAYER: {
      return (syncedState(state).setIn(['ngState', 'selectedLayer'], { layer: action.payload }));
    }
    default: {
      return state;
    }
  }
}
