/**
 * Font loading. Archivo for display, IBM Plex Sans for UI, IBM Plex Mono for
 * numbers (PRD Appendix C). Mono carries the money and the analyzer output so
 * columns of figures line up.
 */
import {
  Archivo_600SemiBold,
  Archivo_700Bold,
  useFonts as useArchivo,
} from '@expo-google-fonts/archivo';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';

export function useAppFonts(): [boolean, Error | null] {
  return useArchivo({
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
}
