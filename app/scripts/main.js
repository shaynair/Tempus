'use strict';

// --------------- AUTH -----------------

let webAuth;
let userId;
const hospitalKey = 'ID1000';
const states = ['Waiting', 'Has bed', 'Has doctor', 'Finished'];
const auth0Domain = 'open-data-health.auth0.com';
const functionsURL = 'https://us-central1-open-data-health.cloudfunctions.net/'
const CLIENT_ID = 'LPtY1mLEhG09EHCQpEHG4kQlWH86kBax';
const firebasePrefix = 'firebase:authUser:';
const firebaseSuffix = ':[DEFAULT]';

async function setup() {
  // Initialize Firebase
  firebase.initializeApp({
    apiKey: 'AIzaSyCw-kxGQMftFgxTPE3ShPzfyF7TtMr7hM4',
    authDomain: 'open-data-health.firebaseapp.com',
    databaseURL: 'https://open-data-health.firebaseio.com',
    projectId: 'open-data-health',
    storageBucket: '',
    messagingSenderId: '80108259279'
  });

  webAuth = new auth0.WebAuth({
    domain: auth0Domain,
    clientID: CLIENT_ID,
    audience: 'https://' + auth0Domain + '/userinfo'
  });
  let authResult = await Promise.promisify(webAuth.parseHash.bind(webAuth))();
  if (authResult && authResult.accessToken && authResult.idToken) {
    window.location.hash = '';
    await setSession(authResult);
  }
  await displayButtons();
}

async function setSession(authResult) {
  localStorage.setItem('access_token', authResult.accessToken);
  localStorage.setItem('id_token', authResult.idToken);
  localStorage.setItem('profile', JSON.stringify(authResult.idTokenPayload));
  localStorage.setItem('expires_at', JSON.stringify(authResult.expiresIn * 1000 + new Date().getTime()));

  let token = (await axios({
    method: 'post',
    data: {
      email: authResult.idTokenPayload.email
    },
    baseURL: functionsURL,
    url: '/delegateToken',
    headers: {
      Authorization: 'Bearer ' + authResult.accessToken
    }
  })).data;
  localStorage.setItem('firebase_token', token);
}

async function logout(e = null) {
  if (e) e.preventDefault();
  localStorage.removeItem('access_token');
  localStorage.removeItem('id_token');
  localStorage.removeItem('profile');
  localStorage.removeItem('expires_at');
  localStorage.removeItem('firebase_token');
  await firebase.auth().signOut();
  webAuth.logout({ returnTo: window.location.href, clientID: CLIENT_ID });
}

function isAuthenticated() {
  // Check whether the current time is past the
  // access token's expiry time
  return localStorage.getItem('id_token') && localStorage.getItem('access_token') && localStorage.getItem('firebase_token')
       && localStorage.getItem('profile') && new Date().getTime() < JSON.parse(localStorage.getItem('expires_at'));
}

async function displayButtons() {
  if (!isAuthenticated()) {
    $('#main').hide();
    webAuth.authorize({
      clientID: CLIENT_ID,
      scope: 'openid email profile',
      responseType: 'token id_token',
      redirectUri: window.location.href
    });
  } else {
    userId = (await firebase.auth().signInWithCustomToken(localStorage.getItem('firebase_token'))).m;
    if (!getUserString()) {
      // Re-auth
      await logout();
      return await displayButtons();
    }
    setupUI();
  }
}

function getUserString() {
  return localStorage.getItem(firebasePrefix + userId + firebaseSuffix);
}

function getUser() {
  return JSON.parse(getUserString());
}

// ----------------- UI ---------------

let index = -1;
let navi = {
  ministry: [
    { icon: 'home', title: 'Dashboard', render: ministryDashboard },
    { icon: 'show_chart', title: 'LHINs', search: true, render: ministryLHINs, listen: '/lhins' },
    { icon: 'local_hospital', title: 'Hospitals', search: true, render: ministryHospitals, listen: '/lhins' }
  ],
  nurse: [
    { icon: 'home', title: 'Dashboard', render: nurseDashboard, badge: '1' },
    { icon: 'people', title: 'Patients', search: true, addIndex: 2, render: nursePatients, listen: '/hospitals/' + hospitalKey + '/patients' },
    { navIndex: 1, title: 'Add Patient', render: nurseAddPatient }
  ]
};
let templates = {};

function getSimpleUserId() {
  let { uid } = firebase.auth().currentUser;
  return uid.substring(0, uid.indexOf('@'));
}

function setupUI() {
  let user = getSimpleUserId();
  let fullUser = JSON.parse(localStorage.getItem('profile'));

  // Templates
  $('script').each((i, elem) => {
    let $elem = $(elem);
    if ($elem.attr('type') === 'text/x-handlebars-template') {
      templates[$elem.attr('id')] = Handlebars.compile($elem.html());
      $elem.remove();
    }
  });

  // Navigation setup
  let $nav = $('.demo-navigation .mdl-layout-spacer');
  let navdata = navi[user];
  for (let i = 0; i < navdata.length; i++) {
    let n = navdata[i];
    if (n.hasOwnProperty('navIndex')) continue;
    let $item = $('<a class="mdl-navigation__link" id="nav' + i + '" href="">' + (n.badge ? '<div class="mdl-badge" data-badge="' + n.badge + '">' : '') + '<i class="mdl-color-text--blue-grey-400 material-icons" role="presentation">' + n.icon + '</i>'  + n.title + (n.badge ? '</div>' : '') + '</a>');
    $item.click(e => navigate(i, e));
    $nav.before($item);
  }
  navigate(0);

  // Offline detection
  $('#offlinebar').hide();
  let temp = false;
  firebase.database().ref('.info/connected').on('value', snap => {
    if (snap.val() !== true) {
      if (temp) {
        snackbar('You have gone offline. Changes will persist once you go back online.');
        $('#offlinebar').show();
      }
      temp = true;
    } else {
      $('#offlinebar').hide();
    }
  });

  // Charts
  Highcharts.setOptions({global: {useUTC: false}});

  // UI setup
  $('#logout').click(logout);

  $('#accname').text(fullUser.email);
  $('.demo-avatar').attr('src', fullUser.picture);
  $('#loadingmain').hide();
  $('#main').smoothState();
  $('#main').show();
}
function navigate(i, e = null) {
  if (e) e.preventDefault();
  if (index === i) return;

  $('#loadingcontent').show();

  $('#nav' + index).removeClass('active');
  $('#content').children().remove();
  index = i;
  $('#search').val('');

  let n = navi[getSimpleUserId()][i];
  $('.mdl-layout-title').text(n.title);
  if (n.search) {
    $('#searchbar').show();
  } else {
    $('#searchbar').hide();
  }
  if (n.hasOwnProperty('addIndex')) {
    $('#addbtn').off('click').click(e => navigate(n.addIndex, e)).show();
  } else {
    $('#addbtn').hide();
  }
  if (n.hasOwnProperty('navIndex')) {
    $('#backbtn').off('click').click(e => navigate(n.navIndex, e)).show();
    $('#nav' + n.navIndex).addClass('active');
  } else {
    $('#backbtn').hide();
    $('#nav' + i).addClass('active');
  }
  let storedVal = null;
  let render = async (val) => {
    val = val || storedVal;
    storedVal = val;
    let dbValues = val && val.val ? val.val() : (n.memory || val);
    if (n.search && dbValues && n.query) {
      dbValues = _.mapValues(_.groupBy(Object.keys(dbValues).filter(id => dbValues[id].name.toLowerCase().indexOf(n.query.toLowerCase()) >= 0).map(id => Object.assign({id}, dbValues[id])), 'id'), dbVal => dbVal[0]);
    }
    if (index == i) {
      let { load, html, functions } = n.render();
      if (!n.load) {
        n.load = await load();
      }
      let $toAdd = $(html(n.load, dbValues));
      $('#content').children().remove();
      $('#content').hide();
      $('#content').append($toAdd);
      if(!(typeof(componentHandler) == 'undefined')){
        componentHandler.upgradeAllRegistered();
      }
      functions(n.load, dbValues);
      $('#content').show();
      $('#loadingcontent').hide();
    } else {
      n.memory = dbValues;
    }
  };
  $('#search').off('keypress').keypress(e => {
    if (e.which === 13) {
      n.query = $('#search').val();
      return render();
    }
  });
  $('#searchbtn').off('click').click(() => {
    n.query = $('#search').val();
    return render();
  });
  if (n.listen && !n.memory) {
    return firebase.database().ref(n.listen).orderByKey().on('value', render);
  } else {
    return render();
  }
}

function snackbar(message, timeout = 2000) {
  let data = {
    message,
    timeout,
    actionHandler: () => $('#demo-toast-example').removeClass('mdl-snackbar--active'),
    actionText: 'Dismiss'
  };
  $('#demo-toast-example')[0].MaterialSnackbar.showSnackbar(data);
}

function nurseDashboard() {
  return {
    load: async () => {
      let data = ['name', 'beds', 'doctors', 'data'];
      let js = {};
      for (let d of data) {
        js[d] = firebase.database().ref('/hospitals/' + hospitalKey + '/' + d).once('value');
      }
      return _.mapValues(await Promise.props(js), val => val.val());
    },
    html: (data) => {
      return templates['dashboard-template']({
        one: data.beds,
        onetext: 'Beds',
        two: data.doctors,
        twotext: 'Doctors',
        cards: templates['nurse-cards']()
      });
    },
    functions: (data) => {
      $('#updatebtn').click(e => navigate(2, e));
      $('#chkbox1').change(() => {
        $('#chartone').toggle();
        //$('#chkbox1').checked
      });
      $('#chkbox2').change(() => {
        $('#charttwo').toggle();
        //$('#chkbox1').checked
      });
      let datapoints = Object.keys(data.data).sort((a, b) => new Date(data.data[a].time).getTime() - new Date(data.data[b].time).getTime());
      Highcharts.chart('graphdash', {
        chart: {
            type: 'spline',
            animation: Highcharts.svg, // don't animate in old IE
            marginRight: 10,
            events: {
                load: function () {
                  ['beds', 'doctors'].forEach((type, index) => {
                    firebase.database().ref('/hospitals/' + hospitalKey + '/' + type).on('value', val => this.series[index].addPoint([new Date().getTime(), val.val()], true, true));
                  });
                }
            }
        },
        title: {
            text: 'Beds and doctors in ' + data.name
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: 'Value'
            },
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        tooltip: {
            formatter: function () {
                return '<b>' + this.series.name + '</b><br/>' +
                    Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
                    Highcharts.numberFormat(this.y, 2);
            }
        },
        legend: {
            enabled: true
        },
        exporting: {
            enabled: true
        },
        series: [{
            name: 'Beds',
            data: datapoints.map(d => { return {x: new Date(data.data[d].time).getTime(), y: data.data[d].beds} })
        }, {
          name: 'Doctors',
          data: datapoints.map(d => { return {x: new Date(data.data[d].time).getTime(), y: data.data[d].doctors} })
        }]
      });
    }
  }
}
function nursePatients() {
  return {
    load: async () => {},
    html: (data, patients) => templates['list-template']({
      objects: _.mapValues(patients, (patient, id) => {
        return {
          name: patient.name,
          icon: 'person',
          state: states[patient.state] + ' (Updated: ' + (new Date(patient.updateTime).toLocaleString()) + ')',
          html: templates['patient-template']({patient, id})
        };
      })
    }),
    functions: (data, patients) => {
      for (let id of Object.keys(patients || {})) {
        $('#option-' + patients[id].state + '-' + id)[0].parentNode.MaterialRadio.check();
        $('#submit-' + id).click(async e => {
          let oldState = patients[id].state;
          let bedDelta = 0, doctorDelta = 0;

          e.preventDefault();
          let $checked = $('input[name="options-' + id + '"]:checked');
          let newState = parseInt($checked.val());

          if (oldState !== 1 && newState === 1) {
            bedDelta--;
          } else if (newState !== 1 && oldState === 1) {
            bedDelta++;
          }

          if (oldState !== 2 && newState === 2) {
            doctorDelta--;
          } else if (newState !== 2 && oldState === 2) {
            doctorDelta++;
          }

          await firebase.database().ref('/hospitals/' + hospitalKey + '/patients/' + id)
              .update({state: newState, updateTime: new Date().toISOString()});
          if (bedDelta !== 0 || doctorDelta !== 0) {
            let totalBeds = 0, totalDoctors = 0;
            await firebase.database().ref('/hospitals/' + hospitalKey).transaction(hospital => {
              if (hospital) {
                hospital.beds = (hospital.beds || 1) + bedDelta;
                hospital.doctors = (hospital.doctors || 1) + doctorDelta;

                totalBeds = hospital.beds;
                totalDoctors = hospital.doctors;
              }
              return hospital;
            });

            let ref = firebase.database().ref('/hospitals/' + hospitalKey + '/data/');
            let {key} = ref.push();

            await ref.update({[key]: { time: new Date().toISOString(), beds: totalBeds, doctors: totalDoctors }});

            delete navi[getSimpleUserId()][0].load;
          }
          snackbar(patients[id].name + '\'s state changed to \'' + $checked.next().text() + '\'.');
        })
      }
    }
  }
}
function nurseAddPatient() {
  return {
    load: async () => {},
    html: () => templates['form-template'](),
    functions: () => {
      $('#patientsubmit').click(async e => {
        e.preventDefault();
        if (!$('#patientname').val()) {
          return snackbar('You need to enter the patient name.');
        }
        let ref = firebase.database().ref('/hospitals/' + hospitalKey + '/patients');
        let { key } = ref.push();
        await ref.update({[key]: { name: $('#patientname').val(), state: 0, createTime: new Date().toISOString(), updateTime: new Date().toISOString() }});
        snackbar($('#patientname').val() + ' added as a patient.');
        navigate(1);
      });
    }
  }
}
function ministryDashboard() {
  return {
    load: async () => {
      let data = ['lhins'];
      let js = {};
      for (let d of data) {
        js[d] = firebase.database().ref('/' + d).once('value');
      }
      return _.mapValues(await Promise.props(js), val => val.val());
    },
    html: (data) => {
      let count = 0;
      for (let k in data.lhins) {
        if (!data.lhins.hasOwnProperty(k)) continue;
        for (let h in data.lhins[k].hospitals) {
          if (!data.lhins[k].hospitals.hasOwnProperty(h)) continue;
          count++;
        }
      }
      return templates['dashboard-template']({
        one: Object.keys(data.lhins).length,
        onetext: 'LHIN(s)',
        two: count,
        twotext: 'Hospital(s)',
        cards: templates['ministry-cards']()
      })
    },
    functions: (data) => {
      $('#chkbox1').change(() => {
        $('#chartone').toggle();
        //$('#chkbox1').checked
      });
      $('#chkbox2').change(() => {
        $('#charttwo').toggle();
        //$('#chkbox1').checked
      });
    }
  }
}
function ministryLHINs() {
  return {
    load: async () => {},
    html: (data, lhins) => templates['list-template']({
      objects: _.mapValues(lhins, (lhin, id) => {
        return {
          name: lhin.name,
          state: '',
          icon: 'insert_chart',
          html: templates['hospital-template']({lhin, id})
        };
      })
    }),
    functions: (data, lhins) => {
      for (let k in lhins) {
        if (!lhins.hasOwnProperty(k)) continue;
        let ob = lhins[k];

        let ctx = $('#hospitalChart-' + k)[0].getContext('2d');

        let chartData = {
          labels: ob.hospitals[Object.keys(ob.hospitals)[0]].dates,
          datasets: [{
            label: 'Daily average number of patients in ER waiting for beds at ' + ob.name + ' (historical)',
            data: ob.hospitals[Object.keys(ob.hospitals)[0]].num_waiting_patients.map((n, index) => {
              let sum = 0;
              for (let h in ob.hospitals) {
                if (!ob.hospitals.hasOwnProperty(h)) continue;
                sum += ob.hospitals[h].num_waiting_patients[index];
              }
              return sum;
            }),
						borderColor: '#ffb88c',
            pointBackgroundColor: '#fff',
            pointBorderColor: '#ffb88c',
            pointHoverBackgroundColor: '#ffb88c',
            pointHoverBorderColor: '#fff',
            pointRadius: 4,
            pointHoverRadius: 4,
            fill: false
          }]
        };

        let options = {
          bezierCurve: false,
          elements: {
            line: {
              tension: 0.002
            }
          }
        }

        let hospitalChart = new Chart(ctx, {
          type: 'line',
          data: chartData,
          options: options
        });
      }
    }
  }
}
function ministryHospitals() {
  return {
    load: async () => {},
    html: (data, lhins) => {
      let hospitals = {};
      let id = 1;
      for (let k in lhins) {
        if (!lhins.hasOwnProperty(k)) continue;
        for (let h in lhins[k].hospitals) {
          if (!lhins[k].hospitals.hasOwnProperty(h)) continue;
          hospitals[id] = lhins[k].hospitals[h];
          hospitals[id].name = '(' + lhins[k].name + ') ' + h;
          id++;
        }
      }
      return templates['list-template']({
        objects: _.mapValues(hospitals, (hospital, id) => {
          return {
            name: hospital.name,
            state: hospital.type,
            icon: 'local_hospital',
            html: templates['hospital-template']({hospital, id})
          };
        })
      })
    },
    functions: (data, lhins) => {
      let id = 1;
      for (let k in lhins) {
        if (!lhins.hasOwnProperty(k)) continue;
        for (let h in lhins[k].hospitals) {
          if (!lhins[k].hospitals.hasOwnProperty(h)) continue;
          let ob = lhins[k].hospitals[h];
          let ctx = $('#hospitalChart-' + id)[0].getContext('2d');

          let chartData = {
            labels: ob.dates,
            datasets: [{
              label: 'Daily average number of patients in ER waiting for beds at ' + h + ' (historical)',
              data: ob.num_waiting_patients,
              borderColor: '#ffb88c',
              pointBackgroundColor: '#fff',
              pointBorderColor: '#ffb88c',
              pointHoverBackgroundColor: '#ffb88c',
              pointHoverBorderColor: '#fff',
              pointRadius: 4,
              pointHoverRadius: 4,
              fill: false
            }]
          };

          let options = {
            bezierCurve: false,
            elements: {
              line: {
                tension: 0.002
              }
            }
          }

          let hospitalChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: options
          });
          id++;
        }
      }
    }
  }
}


$(setup);
