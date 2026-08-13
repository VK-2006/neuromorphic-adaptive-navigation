try:
    import torch, torch.nn as nn
    import snntorch as snn
    SNN_AVAILABLE=True
    class RiskSNN(nn.Module):
        def __init__(self,input_size=11,hidden=32,outputs=4,beta=.92):
            super().__init__(); self.fc1=nn.Linear(input_size,hidden); self.lif1=snn.Leaky(beta=beta); self.fc2=nn.Linear(hidden,outputs); self.lif2=snn.Leaky(beta=beta,output=True)
        def forward(self,sequence):
            mem1=self.lif1.init_leaky(); mem2=self.lif2.init_leaky(); spikes=[]; membranes=[]
            for step in sequence:
                cur1=self.fc1(step); spk1,mem1=self.lif1(cur1,mem1); cur2=self.fc2(spk1); spk2,mem2=self.lif2(cur2,mem2); spikes.append(spk2); membranes.append(mem2)
            return torch.stack(spikes),torch.stack(membranes)
except Exception:
    SNN_AVAILABLE=False
    RiskSNN=None
