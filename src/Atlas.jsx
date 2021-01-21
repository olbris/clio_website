import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, shallowEqual } from 'react-redux';

import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import AnnotationsList from './Atlas/AnnotationsList';
import AnnotationsFilter from './Atlas/AnnotationsFilter';
import DatasetFilter from './Atlas/DatasetFilter';
import FilterType from './Atlas/FilterType';
import config from './config';

const useStyles = makeStyles({
  window: {
    display: 'flex',
    flexFlow: 'column',
    height: '100%',
  },
  matches: {
    margin: '1em',
  },
  header: {
    margin: '1em',
    flexGrow: 1,
  },
  list: {
    marginTop: '1em',
  },
  expand: {
    display: 'flex',
    flexFlow: 'column',
    height: '100%',
  },
});

const minAnnotations = 4;
const maxAnnotations = 12;

export default function Atlas(props) {
  const { children, actions, datasets } = props;
  const classes = useStyles();

  const [selectedAnnotation, setSelected] = useState(null);
  const [filterType, setFilterType] = useState('Title or description');
  const [filterTerm, setFilterTerm] = useState('');
  const [datasetFilter, setDataSetFilter] = useState([]);
  const [dsLookup, setDsLookup] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showList, setShowList] = useState(true);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState('preload');
  const projectUrl = useSelector((state) => state.clio.get('projectUrl'), shallowEqual);
  const user = useSelector((state) => state.user.get('googleUser'), shallowEqual);

  useEffect(() => {
    // load the annotations from an end point
    if (projectUrl) {
      setLoading('fetching');
      const annotationsUrl = `${projectUrl}/atlas/all`;

      const options = {
        headers: {
          Authorization: `Bearer ${user.getAuthResponse().id_token}`,
        },
      };

      fetch(annotationsUrl, options)
        .then((result) => result.json())
        .then((data) => {
          // sort them so that the newest ones are first in the list.
          const sorted = data.sort((a, b) => b.timestamp - a.timestamp);
          setAnnotations(sorted);
          setLoading('success');
        })
        .catch((error) => {
          console.log(error);
          setLoading('failed');
        });
    }
  }, [projectUrl, user]);

  useEffect(() => {
    const datasetLookup = {};
    datasets.forEach((dataset) => {
      datasetLookup[dataset.name] = dataset;
    });
    setDsLookup(datasetLookup);
  }, [datasets]);

  useEffect(() => {
    if (selectedAnnotation) {
      const selectedDataset = dsLookup[selectedAnnotation.dataset];
      const replaceRegex = new RegExp(`/${config.top_level_function}$`);
      const annotationsUrl = projectUrl.replace(replaceRegex, '');
      const layers = [
        {
          name: selectedDataset.name,
          type: 'image',
          source: {
            url: `precomputed://${selectedDataset.location}`,
          },
        },
        {
          name: 'annotations',
          type: 'annotation',
          source: {
            url: `clio://${annotationsUrl}/${selectedDataset.name}?auth=neurohub&kind=atlas`,
          },
        },
      ];

      if ('layers' in selectedDataset) {
        selectedDataset.layers.forEach((layer) => {
          layers.push({
            name: layer.name,
            type: layer.type,
            source: {
              url: `precomputed://${layer.location}`,
            },
          });
        });
      }

      const viewerOptions = {
        position: selectedAnnotation.location,
        crossSectionScale: 2,
        layers,
        layout: 'xy',
        showSlices: true,
      };

      // because the initViewer action makes some assumptions about the dimensions
      // of the dataset, we have to check for the mb20 dataset and change the
      // dimensions used. This should ideally be fixed in the initViewer action or
      // the dimensions should be passed as part of the dataset object from the clio
      // backend.
      if (selectedDataset.name === 'mb20') {
        viewerOptions.dimensions = {
          x: [4e-9, 'm'],
          y: [4e-9, 'm'],
          z: [4e-9, 'm'],
        };
      }

      actions.initViewer(viewerOptions);
    }
  }, [actions, selectedAnnotation, projectUrl, dsLookup]);

  const handleClearSelection = () => {
    // figure out the page the currently selected annotation is on when
    // the view is not displayed/
    const annotationIndex = annotations.findIndex(
      (item) => (
        item.locationkey === selectedAnnotation.locationkey
        && item.dataset === selectedAnnotation.dataset
      ),
    );

    setSelected(null);
    setShowList(true);
    setCurrentPage(Math.ceil((annotationIndex + 1) / maxAnnotations));
  };

  if (loading === 'failed') {
    return <Typography variant="h5">Failed to load EM Atlas Annotations</Typography>;
  }

  if (loading !== 'success') {
    return (
      <div className={classes.expand}>
        <div className={classes.header}>
          <Grid container spacing={0}>
            <Grid item xs={12} sm={2}>
              <Typography variant="h5">EM Atlas</Typography>
            </Grid>
          </Grid>
        </div>
      </div>
    );
  }

  // do annotation filtering here

  let filteredAnnotations = annotations;
  const annotationsPerPage = selectedAnnotation ? minAnnotations : maxAnnotations;

  if (datasetFilter && datasetFilter.length > 0) {
    /* eslint-disable-next-line max-len */
    filteredAnnotations = annotations.filter((annotation) => datasetFilter.includes(annotation.dataset));
  }

  if (filterTerm) {
    let category = null;
    if (filterType !== 'Title or description') {
      category = filterType.toLowerCase();
    }

    const re = new RegExp(filterTerm, 'i');

    if (category) {
      const categories = ['title', 'description'];
      if (categories.includes(category)) {
        filteredAnnotations = filteredAnnotations.filter((annot) => re.test(annot[category]));
      }
    } else {
      filteredAnnotations = filteredAnnotations.filter(
        /* eslint-disable-next-line max-len */
        (annot) => re.test(annot.title) || re.test(annot.description) || re.test(datasets[annot.dataset].description),
      );
    }
  }

  // must come after the filter code or it wont work.
  const pages = Math.ceil(filteredAnnotations.length / annotationsPerPage);
  const paginatedAnnotations = filteredAnnotations.slice(
    currentPage * annotationsPerPage - annotationsPerPage,
    currentPage * annotationsPerPage,
  );

  const handleAnnotationSelect = (annotation) => {
    const annotationIndex = annotations.findIndex(
      (item) => (
        item.locationkey === annotation.locationkey
        && item.dataset === annotation.dataset
      ),
    );
    setSelected(annotation);
    setCurrentPage(Math.ceil((annotationIndex + 1) / minAnnotations));
  };


  return (
    <div className={classes.expand}>
      <div className={classes.header}>
        <Grid container spacing={0}>
          <Grid item xs={12} sm={2}>
            <Typography variant="h5">EM Atlas</Typography>
          </Grid>
          {showList && (
            <>
              <Grid item xs={12} sm={4}>
                <DatasetFilter
                  datasets={datasets.map((dataset) => dataset.name)}
                  selected={datasetFilter}
                  onChange={setDataSetFilter}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <FilterType
                  selected={filterType}
                  onChange={setFilterType}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <AnnotationsFilter term={filterTerm} onChange={setFilterTerm} />
              </Grid>
              <Grid item xs={12} sm={2} />
              <Grid item xs={12} className={classes.list}>
                <AnnotationsList
                  pages={pages}
                  datasets={dsLookup}
                  currentPage={currentPage}
                  annotations={paginatedAnnotations}
                  loading={!(loading === 'success')}
                  selected={selectedAnnotation || {}}
                  onSelect={handleAnnotationSelect}
                  onChange={setCurrentPage}
                />
              </Grid>
            </>
          )}
          {selectedAnnotation && (
            <Grid item xs={12} sm={10}>
              <p>
                Showing details for annotation {selectedAnnotation.title} in neuroglancer{' '}
                <Button variant="contained" color="primary" onClick={handleClearSelection}>
                  Clear Selection
                </Button>{' '}
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowList((current) => !current)}
                >
                  Toggle Annotation List
                </Button>
              </p>
            </Grid>
          )}
        </Grid>
      </div>

      {selectedAnnotation && <div className={classes.window}>{children}</div>}
    </div>
  );
}

Atlas.propTypes = {
  children: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  datasets: PropTypes.arrayOf(PropTypes.object).isRequired,
};
