// Creating Mapbox map
//---------------------
const map = new mapboxgl.Map({
  container: 'map', //Div id to place map in
  style: 'https://ta.webmapper.nl/wm/styles/utrechtovdtong.json', // style object
  zoom: 13.5,
  center: [5.12311, 52.08883],
  attributionControl: true,
  hash: true,
  maxZoom: 19,
  minZoom: 13,
  pitchWithRotate: false, //disable rotation
  dragRotate: false, 
  maxBounds: [4.970096, 52.026281, 5.195155, 52.14205] //Limit map to Utrecht
});


// Create Object with visited restaurants
//---------------------------------------
// Replace this with list from visited restaurants. Make sure the `osmid` and the `reviewed` is filled in. `name` is arbitrary.
//The OSM ID is used to reference to the points on the map and request the OSM API for more information
const myRestaurants = [
  {
    name: 'De Utrechter',
    reviewed: true,
    osmid: "2710004996",
    blog: "https://utrechtoverdetong.nl/2018/12/30/eetcafe-statenjacht-smakelijk-en-sympathiek-stamppot-eten/"
  },
  {
    name: 'Spageteria',
    reviewed: true,
    osmid: "939756513",
    blog: "https://utrechtoverdetong.nl/2018/12/30/eetcafe-statenjacht-smakelijk-en-sympathiek-stamppot-eten/"

  },
  {
    name: 'Het gegeven paard',
    reviewed: true,
    osmid: "4311592257",
    blog: "https://utrechtoverdetong.nl/2018/12/30/eetcafe-statenjacht-smakelijk-en-sympathiek-stamppot-eten/"

  },
  {
    name: 'Starbucks',
    reviewed: true,
    osmid: "2310276480",
    blog: "https://utrechtoverdetong.nl/2018/12/30/eetcafe-statenjacht-smakelijk-en-sympathiek-stamppot-eten/"

  }
]

// Add the POIS to the map. Based on visited or not
//------------------------------------------------
//Wait till map is loaded to add the POIS
map.on('load', function() {
  //Loop through visited restaurants to build the expression 
  let expression = ["match", ["get", "originalid"]];
  myRestaurants.forEach(function(row) {
    expression.push(row['osmid'], row['reviewed'] == true ? ["concat", ["get", "subsubtype"], "_true"] : ["concat", ["get", "subsubtype"], "_not"])
  })
  expression.push(["concat", ["get", "subsubtype"], "_not"]);

  // Add the point of interest layer for Restaurants and Cafes
  const mylayer = map.addLayer(
    {
      "id": 'pois',
      'type': 'symbol',
      'source': 'wm_visdata',
      'source-layer': 'pois',
      'minzoom': 14,
      'filter': [
        "all",
        [
          "==",
          "type",
          "food_drink"
        ],
        [
          "!in",
          "subsubtype",
          "fast_food",
          "ice_cream",
          "food_court"
        ]
      ],
      'layout': {
        "icon-optional": false,
        "icon-ignore-placement": false,
        "icon-allow-overlap": true,
        "icon-padding": 2,
        'icon-image': expression, //Expression is used to determine icon red or grey
        'icon-size': ["interpolate",["linear"], ["zoom"],
          14, 0.01,
          15, 0.3
        ]
      }
    },
    "district_labels"  //Add the layer before the district labels layer
  );
});

// Map on click show restaurant info from OSM API
//-----------------------------------------------
// OSM API url 
const url = 'https://api.openstreetmap.org/api/0.6/node/'; 
parser = new DOMParser();
//create pop-up object
let popup = new mapboxgl.Popup(); 

// Map on click function for layer `pois`
map.on('click', 'pois', function (e) {
  let feature = [];
  // Get clicked feature id, name and review
  feature.originalid = e.features[0].properties.originalid || null;
  feature.name = e.features[0].properties.name.toUpperCase() || null;
  // Set review blog or not
  feature.reviewed = isReviewed(e.features[0].properties)[0] ? 'Ja! Lees het blog <a href="' + isReviewed(e.features[0].properties)[1] + '">hier.</a>': 'Nog niet' ;
 
  // Make a API Request on OSM ID
  let xhr = new XMLHttpRequest();
  xhr.open('GET', encodeURI(url + feature.originalid));
  xhr.onload = function () {
    if (xhr.status === 200) {
      xmlDoc = parser.parseFromString(xhr.responseText, "text/xml");
      let restaurant = xmlDoc.getElementsByTagName("tag");
      // Check for available tags: Cuisine, opening_hours and website. Not all points contain these
      for (i = 0; i < restaurant.length; i++) {
        // string replacement for better cuisine description
        if (restaurant[i].attributes.k.value == 'cuisine') {
          let keuken = "";
          keuken = restaurant[i].attributes.v.value;
          keuken = keuken.replace(/_/g, " ").replace(/;/g, ", ");
          feature.keuken = toTitleCase(keuken);
        }
        // Opening hours
        if (restaurant[i].attributes.k.value == 'opening_hours') {
          feature.openingstijden = restaurant[i].attributes.v.value.replace(/;/g, "</br>");
        }
        // Website url to <a> tag with string replacement for better readability
        if (restaurant[i].attributes.k.value == 'website') {
          let web = restaurant[i].attributes.v.value;
          feature.website = '<a target="_blank" href="' + web + '">' + web.replace(/https:\/\//g, "").replace(/http:\/\//g, "").replace(/\//g, "") + '</a>';
        }
      };
      // Prepare pop-up text
      let text = `<h2>${feature.name}</h2>`;
      for (let key in feature) {
        if (feature.hasOwnProperty(key) && key != 'name' && key != "originalid") {
          text = text + `<h4>  ${toTitleCase(key)}: </h4> <p> ${feature[key]}</p>`
        }
      }
      // Draw pop-up
      popup
        .setLngLat(e.lngLat) //clicked coordinates
        .setHTML(text) 
        .addTo(map);
    }
  };
  xhr.send();
});

// Toggle mouse to pointer when hovering over a POI
//-----------------------------------------------
map.on('mouseenter', 'pois', function () {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'pois', function () {
  map.getCanvas().style.cursor = '';
});


// Check list for review or not 
//-----------------------------------------------
function isReviewed(props) {
  for (let i = 0; i < myRestaurants.length; i++) {
    if (props.originalid === myRestaurants[i].osmid) {
      return [true , myRestaurants[i].blog];
    }
  }
  return false;
}

// String to title case function
//-----------------------------------------------
function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}