# Railway Deployment Guide

Deploy your Excel Model Analyzer to Railway cloud platform in ~10 minutes.

## 🚀 Quick Deployment Steps

### **1. Railway Account Setup** (2 minutes)
1. Go to [railway.app](https://railway.app)
2. Sign up using your GitHub account
3. Verify your email if prompted
4. Connect your GitHub account if not done automatically

### **2. Import Your Project** (1 minute)
1. Click **"New Project"** in Railway dashboard
2. Select **"Deploy from GitHub repo"**
3. Find and select your `model-analysis` repository
4. Railway will automatically detect it's a Python project

### **3. Configure Environment Variables** (2 minutes)
1. In your project dashboard, go to **"Variables"** tab
2. Click **"New Variable"**
3. Add: `GEMINI_API_KEY` = `your_actual_gemini_api_key`
4. Railway automatically sets `PORT` and other system variables

### **4. Deploy** (3-5 minutes)
1. Railway automatically starts building your app
2. Build process runs:
   - Install Python dependencies (`pip install -r requirements.txt`)
   - Install Node.js dependencies (`npm install`)
   - Build frontend (`npm run build`)
   - Start FastAPI server (`python main.py`)
3. Watch the build logs in real-time
4. Get your public URL when deployment completes

## 🌐 Your App Will Be Live At:
```
https://your-app-name.up.railway.app
```

## 📋 What Railway Automatically Handles

### ✅ **Build Process**
- Detects Python project from `requirements.txt`
- Installs all Python dependencies
- Runs frontend build commands from `package.json`
- Serves static files through FastAPI

### ✅ **Runtime Environment**
- Sets appropriate `PORT` environment variable
- Configures Python runtime
- Handles process management and auto-restart

### ✅ **Infrastructure**
- HTTPS certificates (automatic SSL)
- Load balancing and auto-scaling
- Health monitoring and logging
- Git-based deployments (push to deploy)

## 🔧 Optional: Railway Configuration File

Create `railway.toml` in your project root for custom settings:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "python main.py"

[env]
PYTHONPATH = "/app"
```

## 📊 Monitoring Your Deployment

### **Logs & Debugging**
- View real-time logs in Railway dashboard
- Monitor CPU and memory usage
- Track HTTP request metrics
- Set up alerts for errors

### **Custom Domain (Optional)**
- Add your own domain in Railway settings
- Railway handles SSL certificate generation
- DNS configuration instructions provided

## 💰 Pricing

### **Free Tier Includes:**
- 512MB RAM
- 1GB disk space  
- $5/month in usage credits
- No time limits

### **Paid Plans:**
- Only pay for actual usage
- Automatic scaling based on demand
- Enterprise features available

## 🔄 Continuous Deployment

### **Automatic Updates**
1. Push changes to your GitHub repository
2. Railway automatically detects changes
3. Rebuilds and redeploys your app
4. Zero-downtime deployments

### **Branch Deployments**
- Deploy different branches for testing
- Create preview deployments for pull requests
- Production and staging environments

## 🛠️ Troubleshooting

### **Build Failures**
- Check build logs in Railway dashboard
- Ensure all dependencies are in `requirements.txt`
- Verify `npm run build` works locally

### **Runtime Errors**
- Check application logs for Python errors
- Verify environment variables are set correctly
- Test your app locally before deploying

### **Performance Issues**
- Monitor CPU/memory usage in dashboard
- Consider upgrading to paid plan for more resources
- Optimize your application for cloud deployment

## 🔍 Verification Steps

After deployment, test these features:
1. **File Upload**: Try uploading an Excel file
2. **Cell Analysis**: Test drill-down functionality  
3. **AI Features**: Verify Gemini API integration works
4. **Analyze Mode**: Test BASELINE/NEW comparison
5. **All Modes**: Ensure Label and Analyze tabs work

## 🌟 Production Considerations

### **Security**
- Railway provides HTTPS by default
- Environment variables are encrypted
- No additional security configuration needed

### **Backups**
- Railway handles infrastructure backups
- Your code is backed up in GitHub
- Consider database backups if you add persistent storage

### **Scaling**
- Railway auto-scales based on traffic
- Monitor usage in dashboard
- Upgrade plan if you exceed free tier limits

## 📞 Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Community**: Railway Discord server
- **Your App Logs**: Available in Railway dashboard

---

**Total Deployment Time: ~10 minutes**
**Ongoing Maintenance: Minimal (automated)**