const mongoose=require('mongoose');
const express=require('express');
const path=require('path');
const helmet=require('helmet');
const cors=require('cors');
const cookieParser=require('cookie-parser');
const morgan=require('morgan');
const env=require('./config/env');
const {apiLimiter}=require('./middleware/rateLimits');
const {notFound,errorHandler}=require('./middleware/error');

const cspDirectives={
  defaultSrc:["'self'"],
  baseUri:["'self'"],
  objectSrc:["'none'"],
  formAction:["'self'"],
  frameAncestors:["'self'"],
  scriptSrc:[
    "'self'",
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://accounts.google.com',
    'https://*.gstatic.com',
    'blob:'
  ],
  scriptSrcAttr:["'none'"],
  styleSrc:[
    "'self'",
    "'unsafe-inline'",
    'https://cdn.jsdelivr.net',
    'https://unpkg.com'
  ],
  imgSrc:[
    "'self'",
    'data:',
    'blob:',
    'https://tile.openstreetmap.org',
    'https://*.tile.openstreetmap.org',
    'https://unpkg.com',
    'https://*.googleusercontent.com',
    'https://*.gstatic.com'
  ],
  fontSrc:["'self'",'data:','https://cdn.jsdelivr.net','https://unpkg.com'],
  connectSrc:[
    "'self'",
    'https://accounts.google.com',
    'https://storage.googleapis.com',
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    'wss:'
  ],
  frameSrc:["'self'",'https://accounts.google.com','https://*.google.com'],
  workerSrc:["'self'",'blob:'],
  mediaSrc:["'self'",'blob:'],
  manifestSrc:["'self'"],
  upgradeInsecureRequests:null
};

function createApp(){
  const app=express();
  app.set('trust proxy',1);
  app.use(helmet({
    contentSecurityPolicy:{directives:cspDirectives},
    crossOriginEmbedderPolicy:false,
    crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'}
  }));
  app.use(cors({origin:env.frontendUrl,credentials:true}));
  app.use((req,res,next)=>{
    res.setHeader('Permissions-Policy','geolocation=(self), camera=(self), microphone=(), screen-wake-lock=(self), bluetooth=(self)');
    next();
  });
  app.use(express.json({limit:'2mb'}));
  app.use(express.urlencoded({extended:false,limit:'1mb'}));
  app.use(cookieParser());
  if(env.nodeEnv!=='test')app.use(morgan('combined'));
  app.use('/api/v1',apiLimiter,require('./middleware/activityLogger'));
  app.get('/health',(req,res)=>res.json({status:'ok',service:'navora-backend',mode:env.simulationMode?'simulation-capable':'live',database:mongoose.connection.readyState===1?'connected':'degraded',commit:process.env.RENDER_GIT_COMMIT||null}));
  app.use('/api/v1/auth',require('./routes/authRoutes'));
  app.use('/api/v1/geocoding',require('./routes/geocodingRoutes'));
  app.use('/api/v1/routes',require('./routes/routeRoutes'));
  app.use('/api/v1/traffic',require('./routes/trafficRoutes'));
  app.use('/api/v1/weather',require('./routes/weatherRoutes'));
  app.use('/api/v1/roboflow',require('./routes/roboflowRoutes'));
  app.use('/api/v1/journeys',require('./routes/journeyRoutes'));
  app.use('/api/v1/tracking',require('./routes/trackingRoutes'));
  app.use('/api/v1/live',require('./routes/liveRoutes'));
  app.use('/api/v1/hazards',require('./routes/hazardRoutes'));
  const g=require('./routes/genericRoutes');
  app.use('/api/v1/users',g.users);
  app.use('/api/v1/devices',g.devices);
  app.use('/api/v1/memory',g.memory);
  app.use('/api/v1/notifications',g.notifications);
  app.use('/api/v1/trusted-contacts',g.contacts);
  app.use('/api/v1/chat',require('./routes/chatRoutes'));
  app.use('/api/v1/sos',require('./routes/sosRoutes'));
  app.use('/api/v1/admin',require('./routes/adminRoutes'));
  app.use('/api/v1/simulation',require('./routes/simulationRoutes'));
  const publicDir=path.resolve(__dirname,'../../frontend/public'),assetsDir=path.resolve(__dirname,'../../frontend/assets'),frontDir=path.resolve(__dirname,'../../frontend');
  app.use('/assets',express.static(assetsDir,{maxAge:0,etag:true}));
  app.get('/manifest.json',(req,res)=>res.sendFile(path.join(frontDir,'manifest.json'));
  app.get('/service-worker.js',(req,res)=>{
    res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontDir,'service-worker.js'));
  });
  app.use(express.static(publicDir));
  app.use('/api',notFound);
  app.use(errorHandler);
  return app;
}

module.exports={createApp};
