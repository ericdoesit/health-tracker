/**
 * BUILD TRACKER — Google Apps Script
 * ===================================
 * INITIAL SETUP (already done):
 * - Deployed as Web App, URL saved in health-tracker.html
 *
 * WITHINGS SETUP (one time, ~5 min):
 * 1. Go to account.withings.com → click your avatar → Developer Dashboard
 *    (or https://account.withings.com/partner/dashboard_oauth2)
 * 2. Click "Add an App"
 *    - Application name: Build Tracker
 *    - Description: Personal health tracker
 *    - Callback / Redirect URI: [your Apps Script URL — same one in the HTML app settings]
 *    - Scopes: check "user.metrics"
 * 3. Copy your Client ID and Client Secret
 * 4. In Apps Script: click ⚙️ Project Settings → Script Properties → Add property:
 *    - WITHINGS_CLIENT_ID    → paste your Client ID
 *    - WITHINGS_CLIENT_SECRET → paste your Client Secret
 * 5. Redeploy: Deploy → Manage deployments → ✏️ Edit → New version → Deploy
 * 6. In the HTML app → Stack tab → Withings section → tap Connect
 */

const SHEET_ID = '';
const KG_TO_LB = 2.20462;

// ── Routing ─────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = getOrCreateSheet();
    switch (data.type) {
      case 'workout':  logWorkout(ss, data);  break;
      case 'progress': logProgress(ss, data); break;
      case 'protein':  logProtein(ss, data);  break;
      case 'food':     logFood(ss, data);     break;
      case 'test':     logTest(ss, data);     break;
    }
    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  const p = e.parameter;

  // Withings OAuth callback — Withings redirects here with ?code=xxx&state=withings
  if (p.code && p.state === 'withings') {
    return handleWithingsCallback(p.code);
  }

  // Actions called by the HTML app or callback page
  switch (p.action) {
    case 'withings_auth_url':  return jsonResponse(getWithingsAuthUrl(p.redirect_uri));
    case 'withings_status':    return jsonResponse(getWithingsStatus());
    case 'withings_sync':      return jsonResponse(syncWithingsMeasurements());
    case 'withings_latest':    return jsonResponse(getLatestWithingsMeasurement());
    case 'exchange_withings':  return jsonResponse(exchangeWithingsCode(p.code, p.redirect_uri));
  }

  return ContentService.createTextOutput('Build Tracker API — OK').setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Withings OAuth ───────────────────────────────────────────────────────────

function getProps() {
  return PropertiesService.getScriptProperties();
}

function getWithingsAuthUrl(redirectUri) {
  const props = getProps();
  const clientId = props.getProperty('WITHINGS_CLIENT_ID');
  if (!clientId) return { error: 'WITHINGS_CLIENT_ID not set in Script Properties' };

  const callbackUrl = redirectUri || props.getProperty('WITHINGS_CALLBACK_URL') || ScriptApp.getService().getUrl();
  const authUrl = 'https://account.withings.com/oauth2_user/authorize2'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(clientId)
    + '&scope=' + encodeURIComponent('user.metrics')
    + '&redirect_uri=' + encodeURIComponent(callbackUrl)
    + '&state=withings';

  return { url: authUrl };
}

function handleWithingsCallback(code) {
  try {
    const props = getProps();
    const clientId     = props.getProperty('WITHINGS_CLIENT_ID');
    const clientSecret = props.getProperty('WITHINGS_CLIENT_SECRET');
    const scriptUrl    = ScriptApp.getService().getUrl();

    const resp = UrlFetchApp.fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'post',
      payload: {
        action:        'requesttoken',
        grant_type:    'authorization_code',
        client_id:     clientId,
        client_secret: clientSecret,
        code:          code,
        redirect_uri:  scriptUrl,
      }
    });

    const json = JSON.parse(resp.getContentText());
    if (json.status !== 0) throw new Error('Token exchange failed: ' + JSON.stringify(json));

    const body = json.body;
    props.setProperty('WITHINGS_ACCESS_TOKEN',  body.access_token);
    props.setProperty('WITHINGS_REFRESH_TOKEN', body.refresh_token);
    props.setProperty('WITHINGS_EXPIRES_AT',    String(Date.now() + body.expires_in * 1000));
    props.setProperty('WITHINGS_CONNECTED',     'true');

    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body { background:#151515; color:#F1F1F1; font-family:-apple-system,sans-serif;
               display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; }
        .box { padding:32px; }
        h1 { font-size:28px; margin-bottom:8px; }
        p  { color:#999; font-size:15px; }
        .check { font-size:56px; margin-bottom:16px; }
      </style></head><body>
      <div class="box">
        <div class="check">✓</div>
        <h1>Withings Connected</h1>
        <p>You can close this tab and return to the Build Tracker app.</p>
      </div></body></html>`);
  } catch (err) {
    return HtmlService.createHtmlOutput(`
      <html><body style="background:#151515;color:#D03737;font-family:sans-serif;padding:32px;text-align:center">
      <h2>Connection Failed</h2><p>${err.toString()}</p>
      <p style="color:#999">Close this tab and try again.</p>
      </body></html>`);
  }
}

// Called by the GitHub Pages callback page via fetch — returns JSON instead of HTML
function exchangeWithingsCode(code, redirectUri) {
  try {
    if (!code) return { status: 'error', message: 'No code provided' };
    const props = getProps();
    const clientId     = props.getProperty('WITHINGS_CLIENT_ID');
    const clientSecret = props.getProperty('WITHINGS_CLIENT_SECRET');
    const callbackUrl  = redirectUri || props.getProperty('WITHINGS_CALLBACK_URL') || ScriptApp.getService().getUrl();

    const resp = UrlFetchApp.fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'post',
      payload: {
        action:        'requesttoken',
        grant_type:    'authorization_code',
        client_id:     clientId,
        client_secret: clientSecret,
        code:          code,
        redirect_uri:  callbackUrl,
      }
    });

    const json = JSON.parse(resp.getContentText());
    if (json.status !== 0) return { status: 'error', message: 'Withings error: ' + JSON.stringify(json) };

    const body = json.body;
    props.setProperty('WITHINGS_ACCESS_TOKEN',  body.access_token);
    props.setProperty('WITHINGS_REFRESH_TOKEN', body.refresh_token);
    props.setProperty('WITHINGS_EXPIRES_AT',    String(Date.now() + body.expires_in * 1000));
    props.setProperty('WITHINGS_CONNECTED',     'true');

    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function getWithingsStatus() {
  const connected = getProps().getProperty('WITHINGS_CONNECTED') === 'true';
  return { connected };
}

function getAccessToken() {
  const props = getProps();
  const expiresAt = parseInt(props.getProperty('WITHINGS_EXPIRES_AT') || '0');
  const accessToken = props.getProperty('WITHINGS_ACCESS_TOKEN');

  // Refresh if expiring within 5 minutes
  if (!accessToken || Date.now() > expiresAt - 300000) {
    return refreshWithingsToken();
  }
  return accessToken;
}

function refreshWithingsToken() {
  const props = getProps();
  const clientId      = props.getProperty('WITHINGS_CLIENT_ID');
  const clientSecret  = props.getProperty('WITHINGS_CLIENT_SECRET');
  const refreshToken  = props.getProperty('WITHINGS_REFRESH_TOKEN');
  const scriptUrl     = ScriptApp.getService().getUrl();

  if (!refreshToken) throw new Error('No refresh token — reconnect Withings');

  const resp = UrlFetchApp.fetch('https://wbsapi.withings.net/v2/oauth2', {
    method: 'post',
    payload: {
      action:         'requesttoken',
      grant_type:     'refresh_token',
      client_id:      clientId,
      client_secret:  clientSecret,
      refresh_token:  refreshToken,
      redirect_uri:   scriptUrl,
    }
  });

  const json = JSON.parse(resp.getContentText());
  if (json.status !== 0) throw new Error('Token refresh failed: ' + JSON.stringify(json));

  const body = json.body;
  props.setProperty('WITHINGS_ACCESS_TOKEN',  body.access_token);
  props.setProperty('WITHINGS_REFRESH_TOKEN', body.refresh_token);
  props.setProperty('WITHINGS_EXPIRES_AT',    String(Date.now() + body.expires_in * 1000));
  return body.access_token;
}

// ── Withings Measurements ────────────────────────────────────────────────────
// meastype: 1=weight, 8=fat mass, 76=muscle mass, 88=bone mass, 77=hydration, 6=fat ratio

function syncWithingsMeasurements() {
  try {
    const token = getAccessToken();

    // Fetch last 30 days of body composition
    const startDate = Math.floor((Date.now() - 30 * 86400000) / 1000);
    const resp = UrlFetchApp.fetch(
      `https://wbsapi.withings.net/measure?action=getmeas&meastypes=1,6,8,76,88,77&category=1&startdate=${startDate}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );

    const json = JSON.parse(resp.getContentText());
    if (json.status !== 0) throw new Error('Withings API error: ' + JSON.stringify(json));

    // Parse into grouped measurements by date
    const byDate = {};
    (json.body.measuregrps || []).forEach(grp => {
      const date = new Date(grp.date * 1000);
      const dateKey = date.toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey, ts: grp.date };
      grp.measures.forEach(m => {
        const val = m.value * Math.pow(10, m.unit);
        byDate[dateKey][m.type] = val;
      });
    });

    const rows = Object.values(byDate).sort((a, b) => a.ts - b.ts);

    // Write to Body Comp sheet
    const ss = getOrCreateSheet();
    let sheet = ss.getSheetByName('Body Comp (Withings)');
    if (!sheet) {
      sheet = ss.insertSheet('Body Comp (Withings)');
      styleHeader(sheet, ['Date','Weight (lb)','Fat Mass (lb)','Muscle Mass (lb)','Bone Mass (lb)','Fat %','Hydration (lb)','Synced At']);
    } else {
      // Clear and rewrite (Withings data is the source of truth)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
    }

    const sheetRows = rows.map(r => [
      r.date,
      r[1]  ? +(r[1]  * KG_TO_LB).toFixed(1) : '',
      r[8]  ? +(r[8]  * KG_TO_LB).toFixed(1) : '',
      r[76] ? +(r[76] * KG_TO_LB).toFixed(1) : '',
      r[88] ? +(r[88] * KG_TO_LB).toFixed(1) : '',
      r[6]  ? +r[6].toFixed(1) : '',
      r[77] ? +(r[77] * KG_TO_LB).toFixed(1) : '',
      new Date().toLocaleString()
    ]);
    if (sheetRows.length > 0) sheet.getRange(2, 1, sheetRows.length, 8).setValues(sheetRows);

    // Return the latest measurement for the app to display
    const latest = rows[rows.length - 1];
    return {
      status: 'ok',
      synced: rows.length,
      latest: latest ? formatMeasurement(latest) : null,
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function getLatestWithingsMeasurement() {
  try {
    const token = getAccessToken();
    const resp = UrlFetchApp.fetch(
      'https://wbsapi.withings.net/measure?action=getmeas&meastypes=1,6,8,76,88,77&category=1&limit=5',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const json = JSON.parse(resp.getContentText());
    if (json.status !== 0) throw new Error('Withings API error');

    const grps = (json.body.measuregrps || []).sort((a, b) => b.date - a.date);
    if (grps.length === 0) return { status: 'ok', latest: null };

    // Merge most recent groups (sometimes split across 2 groups for same weigh-in)
    const merged = {};
    const latestTs = grps[0].date;
    grps.filter(g => Math.abs(g.date - latestTs) < 60).forEach(grp => {
      grp.measures.forEach(m => {
        merged[m.type] = m.value * Math.pow(10, m.unit);
      });
    });
    merged.date = new Date(latestTs * 1000).toISOString().split('T')[0];
    merged.ts   = latestTs;

    return { status: 'ok', latest: formatMeasurement(merged) };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function formatMeasurement(r) {
  return {
    date:    r.date,
    weight:  r[1]  ? +(r[1]  * KG_TO_LB).toFixed(1) : null,
    fatMass: r[8]  ? +(r[8]  * KG_TO_LB).toFixed(1) : null,
    muscle:  r[76] ? +(r[76] * KG_TO_LB).toFixed(1) : null,
    bone:    r[88] ? +(r[88] * KG_TO_LB).toFixed(1) : null,
    fatPct:  r[6]  ? +r[6].toFixed(1) : null,
    hydro:   r[77] ? +(r[77] * KG_TO_LB).toFixed(1) : null,
  };
}

// ── Sheet Logging ────────────────────────────────────────────────────────────

function getOrCreateSheet() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const files = DriveApp.getFilesByName('Build Tracker — Eric Zunkley');
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  const ss = SpreadsheetApp.create('Build Tracker — Eric Zunkley');
  setupSheets(ss);
  return ss;
}

function setupSheets(ss) {
  const default_ = ss.getSheets()[0];
  default_.setName('Workouts');
  styleHeader(default_, ['Date', 'Day', 'Workout Name', 'Timestamp']);
  styleHeader(ss.insertSheet('Progress'),  ['Date', 'Weight (lb)', 'Waist (in)', 'Fat Mass (lb)', 'Muscle Mass (lb)', 'BF%', 'Timestamp']);
  styleHeader(ss.insertSheet('Protein'),   ['Date', 'Total Protein (g)', 'Target (g)', 'Timestamp']);
  styleHeader(ss.insertSheet('Food Log'),  ['Date', 'Meal', 'Food', 'Serving', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Timestamp']);
  setupDashboard(ss.insertSheet('Dashboard'));
}

function styleHeader(sheet, headers) {
  const row = sheet.getRange(1, 1, 1, headers.length);
  row.setValues([headers]).setBackground('#151515').setFontColor('#F1F1F1').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 140);
}

function setupDashboard(sheet) {
  sheet.getRange('A1').setValue('BUILD TRACKER — ERIC ZUNKLEY').setFontSize(16).setFontWeight('bold');
  [['Phase','CUT'],['Goal Weight (lb)',167],['Protein Target (g)',250],['TDEE (cal)',2500],['Cut Calories (cal)',2100],
   ['',''],['Starting Weight Apr 17',199.0],['Starting Fat (lb)',35.1],['Starting Muscle (lb)',156.6]]
    .forEach(([k,v], i) => { sheet.getRange(i+2,1).setValue(k).setFontWeight('bold'); sheet.getRange(i+2,2).setValue(v); });
}

function logWorkout(ss, data) {
  const sheet = getOrMakeSheet(ss, 'Workouts', ['Date','Day','Workout Name','Timestamp']);
  sheet.appendRow([data.date || today(), data.day || '', data.name || '', now()]);
}

function logProgress(ss, data) {
  const sheet = getOrMakeSheet(ss, 'Progress', ['Date','Weight (lb)','Waist (in)','Fat Mass (lb)','Muscle Mass (lb)','BF%','Timestamp']);
  const bf = data.fat && data.weight ? (data.fat / data.weight * 100).toFixed(1) : '';
  sheet.appendRow([data.date ? new Date(data.date).toLocaleDateString() : today(), data.weight||'', data.waist||'', data.fat||'', data.muscle||'', bf, now()]);
}

function logProtein(ss, data) {
  const sheet = getOrMakeSheet(ss, 'Protein', ['Date','Total Protein (g)','Target (g)','Timestamp']);
  sheet.appendRow([data.date || today(), data.total||0, data.target||250, now()]);
}

function logFood(ss, data) {
  const sheet = getOrMakeSheet(ss, 'Food Log', ['Date','Meal','Food','Serving','Calories','Protein (g)','Carbs (g)','Fat (g)','Timestamp']);
  sheet.appendRow([data.date||today(), data.meal||'', data.name||'', data.serving||'', data.cal||0, data.protein||0, data.carbs||0, data.fat||0, now()]);
}

function logTest(ss, data) {
  getOrMakeSheet(ss, 'Workouts', []).appendRow(['TEST', 'Connection successful', data.message||'', now()]);
}

function getOrMakeSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); if (headers.length) styleHeader(sheet, headers); }
  return sheet;
}

function today() { return new Date().toLocaleDateString(); }
function now()   { return new Date().toLocaleString(); }

// Run once manually in Apps Script editor to initialize the sheet
function manualSetup() {
  const ss = getOrCreateSheet();
  Logger.log('Sheet: ' + ss.getUrl());
}
