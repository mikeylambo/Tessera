export function createGodotMotionImpactManifest(input) {
    return {
        version: 1,
        packageId: input.packageId,
        rigs: input.rigs ?? [],
        clips: input.clips ?? [],
        impacts: input.impacts ?? [],
        importHints: {
            animationPlayerNode: input.animationPlayerNode ?? "AnimationPlayer",
            skeletonNode: input.skeletonNode ?? "Skeleton3D",
            useRootMotion: input.useRootMotion ?? true,
            markerSignal: "slu_motion_marker",
        },
    };
}
export function godotMarkerMethodTrack(clip) {
    return (clip.markers ?? []).map((marker) => ({
        time: marker.at,
        method: "_slu_motion_marker",
        args: [marker.id, marker.kind, marker.recipeId ?? "", marker.payload ?? {}],
    }));
}
export function generateGodotRuntimeBridge() {
    return `class_name SLUMotionImpactBridge\nextends Node\n\nsignal slu_motion_marker(marker_id: String, kind: String, recipe_id: String, payload: Dictionary)\nsignal slu_impact_requested(recipe_id: String, context: Dictionary)\n\nvar manifest: Dictionary = {}\nvar impact_recipes: Dictionary = {}\n\nfunc load_manifest(value: Dictionary) -> void:\n    manifest = value\n    impact_recipes.clear()\n    for recipe in manifest.get("impacts", []):\n        impact_recipes[recipe.get("id", "")] = recipe\n\nfunc install_animation_markers(animation_player: AnimationPlayer) -> int:\n    var installed := 0\n    for clip in manifest.get("clips", []):\n        var metadata: Dictionary = clip.get("metadata", {})\n        var animation_name := String(metadata.get("animationName", clip.get("id", "")))\n        if animation_name == "" or not animation_player.has_animation(animation_name):\n            push_warning("SLU animation not found for clip: " + String(clip.get("id", "")) + " (expected " + animation_name + ")")\n            continue\n        var animation: Animation = animation_player.get_animation(animation_name)\n        if animation.has_meta("_slu_marker_package") and animation.get_meta("_slu_marker_package") == manifest.get("packageId", ""):\n            continue\n        var track_index := animation.add_track(Animation.TYPE_METHOD)\n        animation.track_set_path(track_index, ".")\n        for marker in clip.get("markers", []):\n            var key := {\n                "method": "_slu_motion_marker",\n                "args": [marker.get("id", ""), marker.get("kind", "custom"), marker.get("recipeId", ""), marker.get("payload", {})]\n            }\n            animation.track_insert_key(track_index, float(marker.get("at", 0.0)), key, 0.0)\n            installed += 1\n        animation.set_meta("_slu_marker_package", manifest.get("packageId", ""))\n    return installed\n\nfunc _slu_motion_marker(marker_id: String, kind: String, recipe_id: String = "", payload: Dictionary = {}) -> void:\n    slu_motion_marker.emit(marker_id, kind, recipe_id, payload)\n    if recipe_id != "":\n        play_impact(recipe_id, payload)\n\nfunc play_impact(recipe_id: String, context: Dictionary = {}) -> void:\n    if not impact_recipes.has(recipe_id):\n        push_warning("SLU impact recipe not found: " + recipe_id)\n        return\n    slu_impact_requested.emit(recipe_id, context)\n`;
}
export function generateGodotImportGuide(manifestPath = "res://slu/motion-impact.json") {
    return `# SLU Motion/Impact Godot Adapter\n\n1. Import the character/animation GLB or FBX into Godot.\n2. Add SLUMotionImpactBridge.gd to the animated actor/presentation root.\n3. Load ${manifestPath} into the bridge.\n4. Call bridge.install_animation_markers(animation_player). SLU creates the Call Method track automatically.\n5. Route slu_impact_requested to your VFX/audio/camera presentation implementation.\n6. For root-motion clips, configure the imported root track in AnimationTree as appropriate for the game.\n`;
}
export class GodotMotionImpactAdapter {
    id = "godot-4";
    displayName = "Godot 4";
    exportPackage(pkg, options = {}) {
        const manifest = createGodotMotionImpactManifest({
            packageId: pkg.id,
            rigs: pkg.rigs,
            clips: pkg.clips,
            impacts: pkg.impacts,
            useRootMotion: options.rootMotion,
            animationPlayerNode: options.animationPlayerPath,
            skeletonNode: options.skeletonPath,
        });
        const markerTracks = Object.fromEntries(pkg.clips.map((clip) => [clip.id, godotMarkerMethodTrack(clip)]));
        return [
            { path: "slu/motion-impact.json", content: JSON.stringify(manifest, null, 2), kind: "manifest" },
            { path: "slu/motion-marker-tracks.json", content: JSON.stringify(markerTracks, null, 2), kind: "resource" },
            { path: "slu/SLUMotionImpactBridge.gd", content: generateGodotRuntimeBridge(), kind: "script" },
            { path: "slu/README.md", content: generateGodotImportGuide(), kind: "documentation" },
        ];
    }
}
