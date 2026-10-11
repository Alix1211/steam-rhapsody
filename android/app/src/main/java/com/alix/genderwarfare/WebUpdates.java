package com.alix.genderwarfare;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipEntry;
import org.json.*;

/** Atomic web-code updates, same appassets origin, APK/offline fallback. */
final class WebUpdates {
    private final Context context;
    private final SharedPreferences prefs;
    private final File root, mediaCache;
    private volatile File active;
    private volatile JSONObject manifest=new JSONObject();
    private JSONObject bundled=new JSONObject();
    WebUpdates(Context c) {
        context=c; prefs=c.getSharedPreferences("webUpdates",Context.MODE_PRIVATE);
        root=new File(c.getFilesDir(),"webUpdates"); root.mkdirs();
        mediaCache=new File(root,"media");mediaCache.mkdirs();
        try { bundled=new JSONObject(new String(read(c.getAssets().open("bundled_media.json"),2000000),"UTF-8")).getJSONObject("media"); } catch(Exception ignored){}
        File dir=new File(root,prefs.getString("version","none"));
        try { if(new File(dir,"index.html").isFile()){manifest=new JSONObject(new String(read(new FileInputStream(new File(dir,"update.json")),2000000),"UTF-8"));active=dir;} }catch(Exception ignored){}
    }
    static String safePath(String path) {
        if(path==null||path.isEmpty()||path.startsWith("/")||path.contains("\\")||path.indexOf('\0')>=0)return null;
        for(String part:path.split("/"))if(part.equals("..")||part.equals("."))return null;
        return path;
    }
    private static byte[] read(InputStream in,int limit)throws Exception{
        try(InputStream input=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] b=new byte[32768];int n;while((n=input.read(b))!=-1){if(out.size()+n>limit)throw new IOException("size");out.write(b,0,n);}return out.toByteArray();
        }
    }
    private static byte[] download(String url,int limit)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(4000);c.setReadTimeout(8000);c.setRequestProperty("User-Agent","GenderWarfare-Updates");
        c.setRequestProperty("Cache-Control","no-cache");
        try{if(c.getResponseCode()!=200)throw new IOException("HTTP "+c.getResponseCode());return read(c.getInputStream(),limit);}finally{c.disconnect();}
    }
    void check(Runnable finished){new Thread(()->{
        try{
            JSONObject release=new JSONObject(new String(download("https://api.github.com/repos/Alix1211/steam-rhapsody/releases/tags/web-latest",2000000),"UTF-8"));
            JSONArray assets=release.getJSONArray("assets");JSONObject zip=null;
            for(int i=0;i<assets.length();i++)if(assets.getJSONObject(i).optString("name").equals("game-web.zip"))zip=assets.getJSONObject(i);
            if(zip==null)throw new IOException("No update");String stamp=zip.getString("updated_at")+":"+zip.getLong("id");
            if(active==null||!stamp.equals(prefs.getString("stamp",""))){
                String url=zip.getString("browser_download_url");if(!url.startsWith("https://github.com/Alix1211/steam-rhapsody/releases/download/"))throw new IOException("URL");
                byte[] bytes=download(url+"?v="+zip.getLong("id"),32000000);
                File staged=new File(root,"stage-"+System.currentTimeMillis());staged.mkdirs();
                long total=0;int count=0;
                try(ZipInputStream input=new ZipInputStream(new ByteArrayInputStream(bytes))){ZipEntry e;
                    while((e=input.getNextEntry())!=null){String path=safePath(e.getName());if(path==null||++count>2000)throw new IOException("path");if(e.isDirectory())continue;
                        if(!(path.endsWith(".html")||path.endsWith(".js")||path.endsWith(".json")))throw new IOException("type");
                        File f=new File(staged,path);f.getParentFile().mkdirs();
                        try(FileOutputStream out=new FileOutputStream(f)){byte[] b=new byte[32768];int n;while((n=input.read(b))!=-1){total+=n;if(total>64000000)throw new IOException("expanded size");out.write(b,0,n);}}
                    }
                }
                for(String name:new String[]{"index.html","meta.js","save_sync.js","purification.html","mecha.html","update.json"})if(!new File(staged,name).isFile())throw new IOException("Incomplete update");
                JSONObject next=new JSONObject(new String(read(new FileInputStream(new File(staged,"update.json")),2000000),"UTF-8"));
                String version=next.getString("version");if(!version.matches("[a-f0-9]{40}"))throw new IOException("version");
                File dest=new File(root,version);
                if(!dest.exists()&&!staged.renameTo(dest))throw new IOException("commit");
                manifest=next;active=dest;prefs.edit().putString("version",version).putString("stamp",stamp).apply();
            }
        }catch(Exception ignored){/* Retain the last complete update or the APK. */}
        finally{finished.run();}
    },"GW-web-update").start();}
    WebResourceResponse serve(String requested){
        String path=safePath(requested);if(path==null)return null;
        String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"application/javascript":path.endsWith(".json")?"application/json":path.endsWith(".webp")?"image/webp":path.endsWith(".png")?"image/png":path.endsWith(".jpg")?"image/jpeg":path.endsWith(".wav")?"audio/wav":path.endsWith(".mp3")?"audio/mpeg":path.endsWith(".ogg")?"audio/ogg":"application/octet-stream";
        try{
            File dir=active;if(dir!=null){File f=new File(dir,path);if(f.isFile())return new WebResourceResponse(mime,"UTF-8",new FileInputStream(f));
                String hash=manifest.optJSONObject("media")==null?"":manifest.getJSONObject("media").optString(path);
                if(!hash.isEmpty()&&!hash.equals(bundled.optString(path))){
                    File cached=new File(mediaCache,hash);
                    if(!cached.isFile())try{
                        String encoded=new android.net.Uri.Builder().path(path).build().getEncodedPath();
                        byte[] bytes=download("https://raw.githubusercontent.com/Alix1211/steam-rhapsody/"+manifest.getString("version")+"/game/"+encoded,32000000);
                        StringBuilder digest=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))digest.append(String.format("%02x",b&255));
                        if(!hash.equals(digest.toString()))throw new IOException("hash");
                        File temp=File.createTempFile("media-",".tmp",mediaCache);try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);}temp.renameTo(cached);
                    }catch(Exception ignored){}
                    if(cached.isFile())return new WebResourceResponse(mime,null,new FileInputStream(cached));
                }
            }
            return new WebResourceResponse(mime,mime.startsWith("text/")||mime.contains("javascript")||mime.contains("json")?"UTF-8":null,context.getAssets().open(path));
        }catch(Exception e){return null;}
    }
}
