import trimesh
import numpy as np

# Create bed frame (box)
frame = trimesh.creation.box(extents=[2.0, 0.4, 2.2])
frame.visual.vertex_colors = [50, 30, 20, 255]

# Create mattress (box with rounded edges approx)
mattress = trimesh.creation.box(extents=[1.9, 0.2, 2.1])
mattress.apply_translation([0, 0.3, 0])
mattress.visual.vertex_colors = [240, 240, 240, 255]

# Create pillow 1
pillow1 = trimesh.creation.box(extents=[0.7, 0.15, 0.5])
pillow1.apply_translation([-0.45, 0.45, -0.7])
pillow1.visual.vertex_colors = [255, 255, 255, 255]

# Create pillow 2
pillow2 = trimesh.creation.box(extents=[0.7, 0.15, 0.5])
pillow2.apply_translation([0.45, 0.45, -0.7])
pillow2.visual.vertex_colors = [255, 255, 255, 255]

# Combine
bed = trimesh.util.concatenate([frame, mattress, pillow1, pillow2])

# Export
bed.export("public/models/bed.glb")
print("bed.glb created")
