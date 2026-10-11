package com.alix.genderwarfare;

import org.junit.Test;
import static org.junit.Assert.*;

public class HapticPatternTest {
    @Test public void preservesSkillPausesAndCancellation() {
        assertArrayEquals(new long[]{35,22,45}, MainActivity.hapticTimings("35,22,45"));
        assertArrayEquals(new long[]{65}, MainActivity.hapticTimings("65"));
        assertArrayEquals(new long[]{0}, MainActivity.hapticTimings("0"));
        assertArrayEquals(new long[]{0,20,40}, MainActivity.hapticTimings(" 0,20,40 "));
    }
    @Test public void rejectsMalformedOrUnboundedPatterns() {
        for (String text : new String[]{null,"","35,,45","35,","-1","10001","NaN","1.5"}) {
            try { MainActivity.hapticTimings(text); fail("accepted: " + text); }
            catch (IllegalArgumentException expected) { }
        }
        String tooMany = "1";
        for (int i=1; i<100; i++) tooMany += ",1";
        try { MainActivity.hapticTimings(tooMany); fail("accepted 100 segments"); }
        catch (IllegalArgumentException expected) { }
    }
}
