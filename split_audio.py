import os
from pydub import AudioSegment
from pydub.silence import split_on_silence

# --- 1. 配置参数 ---

# 您的输入音频文件名
INPUT_FILE = "download (25).wav" 

# 创建一个文件夹来存放输出的音频文件
OUTPUT_DIR = "finnish_letters"

# 芬兰语字母表 (去掉了 Å)
# 脚本会根据这个列表的顺序来命名文件
ALPHABET = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", 
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", 
    "Ä", "Ö"
]

# --- 2. 切割参数 (您可能需要根据您的音频进行微调) ---

# min_silence_len: 判定为静音的最小持续时间 (毫秒)
# 比如, 700ms 表示任何超过 0.7 秒的静音都会被用作分割点
MIN_SILENCE_LEN = 300

# silence_thresh: 低于这个分贝数的声音被认为是静音 (dBFS)
# 您可以根据录音的背景噪音调整。-40 是一个比较常用的值。
SILENCE_THRESH = -35

# keep_silence: 在分割后的音频片段开头和结尾保留一小段静音 (毫秒)
# 这可以防止声音被切得太突兀
KEEP_SILENCE = 200


# --- 3. 脚本主逻辑 ---

def split_alphabet_audio(input_file, output_dir):
    """
    加载音频文件，根据静音进行分割，并用字母表命名保存。
    """
    # 检查输入文件是否存在
    if not os.path.exists(input_file):
        print(f"错误: 找不到文件 '{input_file}'。请确保文件名正确并且文件在同一目录下。")
        return

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"正在加载音频文件: {input_file}...")
    # 从 .wav 文件加载音频
    audio = AudioSegment.from_wav(input_file)

    print("正在根据静音分割音频...")
    # 使用 pydub 的 split_on_silence 函数进行分割
    chunks = split_on_silence(
        audio,
        min_silence_len=MIN_SILENCE_LEN,
        silence_thresh=SILENCE_THRESH,
        keep_silence=KEEP_SILENCE
    )

    print(f"检测到 {len(chunks)} 个音频片段。")
    print(f"字母表中有 {len(ALPHABET)} 个字母。")

    # 检查分割出的片段数量是否与字母表数量匹配
    if len(chunks) != len(ALPHABET):
        print("\n--- 警告 ---")
        print("检测到的音频片段数量与字母表中的字母数量不匹配！")
        print("这可能是因为 '切割参数' (MIN_SILENCE_LEN 或 SILENCE_THRESH) 设置得不理想。")
        print("请尝试调整这些参数：")
        print(" - 如果片段太多 (比如一个字母被切成两段), 请尝试增加 MIN_SILENCE_LEN 的值。")
        print(" - 如果片段太少 (比如两个字母被合并了), 请尝试减小 MIN_SILENCE_LEN 或 提高 SILENCE_THRESH (例如 -35)。")
        return

    print("\n数量匹配，开始导出文件...")
    # 遍历所有分割后的音频块和字母
    for i, chunk in enumerate(chunks):
        letter = ALPHABET[i]
        output_path = os.path.join(output_dir, f"{letter}.wav")
        
        print(f"正在导出: {output_path}")
        chunk.export(output_path, format="wav")

    print(f"\n处理完成！所有文件已保存到 '{output_dir}' 文件夹中。")

# 运行主函数
if __name__ == "__main__":
    split_alphabet_audio(INPUT_FILE, OUTPUT_DIR)