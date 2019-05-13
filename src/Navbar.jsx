import React from "react";
import { Link } from "react-router-dom";
import Select from "react-select";

import { makeStyles } from "@material-ui/core/styles";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import InfoIcon from "@material-ui/icons/Info";

const useStyles = makeStyles(theme => ({
  search: {
    fontFamily: theme.typography.fontFamily,
    width: "15em",
    marginLeft: "2em"
  },
  searchContainer: {
    flexGrow: 1
  },
  title: {
    color: "#fff",
    textDecoration: "none"
  }
}));

const selectStyles = {
  placeholder: () => ({
    color: "#fff"
  }),
  singleValue: provided => ({
    ...provided,
    color: "#fff"
  }),
  menu: provided => ({
    ...provided,
    color: "#333"
  }),
  control: provided => ({
    ...provided,
    background: "#3f51b5",
    border: "1px solid #fff"
  })
};

function Navbar(props) {
  const { history } = props;
  const classes = useStyles();

  const workspaceOptions = ["neuroglancer", "image picker"].map(dataset => ({
    value: dataset.replace(/ /, "_"),
    label: dataset
  }));

  function handleChange(selected) {
    // redirect to the workspace that was chosen.
    history.push(`/${selected.value}`);
  }
  return (
    <AppBar position="static">
      <Toolbar>
        <Link to="/" className={classes.title}>
          <Typography variant="h6" color="inherit">
            neurohub
          </Typography>
        </Link>
        <div className={classes.searchContainer}>
          <Select
            className={classes.search}
            styles={selectStyles}
            onChange={handleChange}
            placeholder="Select a workspace"
            options={workspaceOptions}
          />
        </div>
        <Link to="/about" className={classes.title}>
          <InfoIcon />
        </Link>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
