function csString(value) {
    return value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}
function generateUnityBridge(namespaceName = "SLU") {
    return `using System;\nusing UnityEngine;\n\nnamespace ${namespaceName}\n{\n    public sealed class SLUMotionImpactBridge : MonoBehaviour\n    {\n        public event Action<string,string,string,string> MotionMarker;\n        public event Action<string,string> ImpactRequested;\n\n        public void MotionEvent(string encoded)\n        {\n            // AnimationEvents pass one string: markerId|kind|recipeId|jsonPayload\n            var parts = encoded.Split(new[]{'|'}, 4);\n            var markerId = parts.Length > 0 ? parts[0] : string.Empty;\n            var kind = parts.Length > 1 ? parts[1] : string.Empty;\n            var recipeId = parts.Length > 2 ? parts[2] : string.Empty;\n            var payload = parts.Length > 3 ? parts[3] : "{}";\n            MotionMarker?.Invoke(markerId, kind, recipeId, payload);\n            if (!string.IsNullOrEmpty(recipeId)) ImpactRequested?.Invoke(recipeId, payload);\n        }\n    }\n}\n`;
}
function generateUnityMarkerTable(pkg, namespaceName = "SLU") {
    const rows = pkg.clips.map((clip) => {
        const animationName = typeof clip.metadata?.animationName === "string" ? clip.metadata.animationName : clip.id;
        const markers = (clip.markers ?? []).map((marker) => {
            const payload = csString(JSON.stringify(marker.payload ?? {}));
            return `new Marker(${marker.at}f, "${csString(marker.id)}", "${csString(marker.kind)}", "${csString(marker.recipeId ?? "")}", "${payload}")`;
        }).join(",\n                ");
        return `{ "${csString(animationName)}", new Marker[] {\n                ${markers}\n            } }`;
    }).join(",\n            ");
    return `#if UNITY_EDITOR\nusing System;\nusing System.Collections.Generic;\n\nnamespace ${namespaceName}.Editor\n{\n    public static class SLUMotionMarkerTable\n    {\n        public readonly struct Marker\n        {\n            public readonly float Time; public readonly string Id; public readonly string Kind; public readonly string RecipeId; public readonly string Payload;\n            public Marker(float time, string id, string kind, string recipeId, string payload)\n            { Time = time; Id = id; Kind = kind; RecipeId = recipeId; Payload = payload; }\n        }\n\n        public static readonly IReadOnlyDictionary<string, Marker[]> ByAnimationName = new Dictionary<string, Marker[]>\n        {\n            ${rows}\n        };\n    }\n}\n#endif\n`;
}
function generateUnityEditorImporter(namespaceName = "SLU") {
    return `#if UNITY_EDITOR\nusing UnityEditor;\nusing UnityEngine;\n\nnamespace ${namespaceName}.Editor\n{\n    public sealed class SLUMotionMarkerPostprocessor : AssetPostprocessor\n    {\n        private void OnPostprocessAnimation(GameObject root, AnimationClip clip)\n        {\n            ApplyMarkers(clip);\n        }\n\n        public static bool ApplyMarkers(AnimationClip clip)\n        {\n            if (clip == null || !SLUMotionMarkerTable.ByAnimationName.TryGetValue(clip.name, out var markers)) return false;\n            var events = new AnimationEvent[markers.Length];\n            for (var i = 0; i < markers.Length; i++)\n            {\n                var m = markers[i];\n                events[i] = new AnimationEvent\n                {\n                    time = Mathf.Clamp(m.Time, 0f, clip.length),\n                    functionName = "MotionEvent",\n                    stringParameter = $"{m.Id}|{m.Kind}|{m.RecipeId}|{m.Payload}"\n                };\n            }\n            AnimationUtility.SetAnimationEvents(clip, events);\n            return true;\n        }\n    }\n}\n#endif\n`;
}
export function unityMarkerManifest(pkg) {
    return Object.fromEntries(pkg.clips.map((clip) => [clip.id, (clip.markers ?? []).map((marker) => ({
            id: marker.id,
            at: marker.at,
            kind: marker.kind,
            recipeId: marker.recipeId ?? "",
            payloadJson: JSON.stringify(marker.payload ?? {}),
        }))]));
}
export class UnityMotionImpactAdapter {
    id = "unity-6";
    displayName = "Unity 6";
    exportPackage(pkg, options = {}) {
        const namespaceName = options.packageName ? options.packageName.replace(/[^A-Za-z0-9_]/g, "") : "SLU";
        return [
            { path: "SLU/motion-impact.json", content: JSON.stringify(pkg, null, 2), kind: "manifest" },
            { path: "SLU/motion-marker-events.json", content: JSON.stringify(unityMarkerManifest(pkg), null, 2), kind: "resource" },
            { path: "SLU/Runtime/SLUMotionImpactBridge.cs", content: generateUnityBridge(namespaceName), kind: "script" },
            { path: "SLU/Editor/SLUMotionMarkerTable.cs", content: generateUnityMarkerTable(pkg, namespaceName), kind: "script" },
            { path: "SLU/Editor/SLUMotionMarkerPostprocessor.cs", content: generateUnityEditorImporter(namespaceName), kind: "script" },
            { path: "SLU/README.md", content: "# SLU Motion/Impact Unity Adapter\n\nImport the character/animation FBX or GLB and attach `SLUMotionImpactBridge` to the animated actor. The generated `AssetPostprocessor` matches imported AnimationClip names against the SLU marker table and installs AnimationEvents automatically. Route `ImpactRequested` to your VFX/audio/camera layer. Use Humanoid Avatar retargeting where appropriate.\n", kind: "documentation" },
        ];
    }
}
