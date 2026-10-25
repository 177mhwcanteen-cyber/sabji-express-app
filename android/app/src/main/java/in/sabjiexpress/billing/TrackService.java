package in.sabjiexpress.billing;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;

import java.io.File;
import java.io.FileWriter;

/**
 * सब्ज़ी एक्सप्रेस — गाड़ी की जगह हर मिनट फोन में दर्ज (स्क्रीन बंद होने पर भी)।
 * हर लाइन: ts,lat,lng,acc  या  ts,OFF / ts,ON (कर्मचारी ने लोकेशन बंद/चालू की)
 * ऐप खुलने पर JS यह फाइल पढ़कर सर्वर पर भेज देता है (BtPrinter.trackDrain)।
 */
public class TrackService extends Service implements LocationListener {
    static final String CH = "se_track";
    static final int NID = 4601;
    static volatile boolean running = false;
    static volatile long lastFix = 0;
    private LocationManager lm;
    private long lastSaved = 0;

    static File file(Context c) { return new File(c.getFilesDir(), "trk.txt"); }

    static synchronized void append(Context c, String line) {
        try {
            FileWriter w = new FileWriter(file(c), true);
            w.write(line);
            w.write("\n");
            w.close();
        } catch (Exception ignore) { }
    }

    static synchronized String drain(Context c) {
        try {
            File f = file(c);
            if (!f.exists()) return "";
            byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
            f.delete();
            return new String(b, "UTF-8");
        } catch (Exception e) { return ""; }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @SuppressLint("MissingPermission")
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String who = intent != null && intent.getStringExtra("name") != null ? intent.getStringExtra("name") : "";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(CH, "गाड़ी की लोकेशन", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, MainActivity.class);
        int pf = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, pf);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        Notification n = b.setContentTitle("🥬 सब्ज़ी एक्सप्रेस चालू है")
            .setContentText("गाड़ी की लोकेशन दर्ज हो रही है" + (who.isEmpty() ? "" : " · " + who))
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NID, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!running) {
            lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            try {
                if (lm.getAllProviders().contains(LocationManager.GPS_PROVIDER))
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 60000L, 0f, this, Looper.getMainLooper());
                if (lm.getAllProviders().contains(LocationManager.NETWORK_PROVIDER))
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 60000L, 0f, this, Looper.getMainLooper());
                running = true;
                append(this, System.currentTimeMillis() + ",START");
            } catch (Exception e) {
                append(this, System.currentTimeMillis() + ",NOPERM");
            }
        }
        return START_STICKY;
    }

    @Override
    public void onLocationChanged(Location l) {
        long now = System.currentTimeMillis();
        boolean gps = LocationManager.GPS_PROVIDER.equals(l.getProvider());
        // नेटवर्क वाली जगह सिर्फ़ तब, जब 3 मिनट से GPS न मिला हो
        if (!gps && now - lastFix < 180000L) return;
        if (gps) lastFix = now;
        if (now - lastSaved < 45000L) return;
        lastSaved = now;
        append(this, now + "," + String.format(java.util.Locale.US, "%.6f,%.6f,%d", l.getLatitude(), l.getLongitude(), Math.round(l.getAccuracy())));
    }

    @Override
    public void onProviderDisabled(String p) {
        if (LocationManager.GPS_PROVIDER.equals(p)) append(this, System.currentTimeMillis() + ",OFF");
    }

    @Override
    public void onProviderEnabled(String p) {
        if (LocationManager.GPS_PROVIDER.equals(p)) append(this, System.currentTimeMillis() + ",ON");
    }

    @Override
    public void onStatusChanged(String p, int s, Bundle e) { }

    @Override
    public void onDestroy() {
        running = false;
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignore) { }
        append(this, System.currentTimeMillis() + ",STOP");
        super.onDestroy();
    }
}
