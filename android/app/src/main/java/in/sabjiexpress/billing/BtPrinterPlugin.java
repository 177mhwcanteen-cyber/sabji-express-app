package in.sabjiexpress.billing;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * सब्ज़ी एक्सप्रेस — ब्लूटूथ थर्मल प्रिंटर (ESC/POS, Bluetooth Classic SPP) और A4 प्रिंट/PDF।
 * JS: BtPrinter.list(), BtPrinter.print({address, data(base64)}), BtPrinter.printHtml({html, name})
 */
@CapacitorPlugin(
    name = "BtPrinter",
    permissions = { @Permission(alias = "bt", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class BtPrinterPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private WebView printView; // प्रिंट पूरा होने तक रखना ज़रूरी

    private boolean needPerm() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bt") != PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    @PluginMethod
    public void list(PluginCall call) {
        if (needPerm()) { requestPermissionForAlias("bt", call, "afterPermList"); return; }
        doList(call);
    }

    @PermissionCallback
    private void afterPermList(PluginCall call) {
        if (needPerm()) { call.reject("Bluetooth की अनुमति नहीं मिली"); return; }
        doList(call);
    }

    @SuppressLint("MissingPermission")
    private void doList(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null) { call.reject("इस फोन में Bluetooth नहीं है"); return; }
        if (!a.isEnabled()) { call.reject("फोन का Bluetooth चालू करें"); return; }
        JSArray arr = new JSArray();
        Set<BluetoothDevice> bonded = a.getBondedDevices();
        if (bonded != null) for (BluetoothDevice d : bonded) {
            JSObject o = new JSObject();
            o.put("name", d.getName());
            o.put("address", d.getAddress());
            arr.put(o);
        }
        JSObject r = new JSObject();
        r.put("devices", arr);
        call.resolve(r);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needPerm()) { requestPermissionForAlias("bt", call, "afterPermPrint"); return; }
        doPrint(call);
    }

    @PermissionCallback
    private void afterPermPrint(PluginCall call) {
        if (needPerm()) { call.reject("Bluetooth की अनुमति नहीं मिली"); return; }
        doPrint(call);
    }

    @SuppressLint("MissingPermission")
    private void doPrint(final PluginCall call) {
        final String address = call.getString("address");
        final String data = call.getString("data");
        if (address == null || data == null) { call.reject("प्रिंटर या डेटा नहीं"); return; }
        new Thread(() -> {
            BluetoothSocket s = null;
            try {
                BluetoothAdapter a = adapter();
                if (a == null || !a.isEnabled()) throw new Exception("फोन का Bluetooth चालू करें");
                a.cancelDiscovery();
                BluetoothDevice dev = a.getRemoteDevice(address);
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                try {
                    s = dev.createRfcommSocketToServiceRecord(SPP);
                    s.connect();
                } catch (Exception first) {
                    try { if (s != null) s.close(); } catch (Exception ignore) {}
                    s = dev.createInsecureRfcommSocketToServiceRecord(SPP);
                    s.connect();
                }
                OutputStream out = s.getOutputStream();
                int chunk = 512;
                for (int i = 0; i < bytes.length; i += chunk) {
                    out.write(bytes, i, Math.min(chunk, bytes.length - i));
                    out.flush();
                    Thread.sleep(12);
                }
                Thread.sleep(400);
                call.resolve();
            } catch (Exception e) {
                call.reject("प्रिंटर से जुड़ नहीं पाए — प्रिंटर चालू है? " + e.getMessage());
            } finally {
                try { if (s != null) s.close(); } catch (Exception ignore) {}
            }
        }).start();
    }

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "सब्ज़ी एक्सप्रेस रिपोर्ट");
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = new WebView(getActivity());
                wv.getSettings().setJavaScriptEnabled(false);
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter ad = view.createPrintDocumentAdapter(name);
                        PrintAttributes attrs = new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
                        pm.print(name, ad, attrs);
                        call.resolve();
                    }
                });
                printView = wv;
                wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("प्रिंट नहीं खुला: " + e.getMessage());
            }
        });
    }
}
