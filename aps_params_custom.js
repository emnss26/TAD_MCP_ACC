

var server_url = '/static/';
var ptitle = 'Autodesk Platform Services';
var cf = {
  conf: 'https://developer.doc.config.autodesk.com/bPlouYTd/',
  intConf: 'https://developer.doc.config.internal.autodesk.com/bPlouYTd/',
  int: 'https://developer.doc.internal.autodesk.com/bPlouYTd/',
  ext: 'https://developer.doc.autodesk.com/bPlouYTd/'
};

var adpRegFacets = {
     product: {
         name: 'Prod: Forge Platform',
         key: 'Prod_ForgePlatform',
         id: '6TGj9V600mrIWmGLDpHKGne1KyMOUp5j',
         id_provider: 'appkey'
     }
};

  adpRegFacets.user = {
    provider_name: 'public',
    user_id: 'ANONYMOUS',
    roles: ['public']
  };

var adpConfig = {
    server: 'https://ase.autodesk.com',
    ip_address: '189.203.231.105',
    enable_geo_data : false
};

