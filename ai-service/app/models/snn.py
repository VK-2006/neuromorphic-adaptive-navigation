try:
    import torch, torch.nn as nn
    import snntorch as snn
    SNN_AVAILABLE=True
    class RiskSNN(nn.Module):
        def __init__(self,input_size=14,hidden=64,outputs=4,beta=.92):
            super().__init__()
            self.fc1=nn.Linear(input_size,hidden)
            self.lif1=snn.Leaky(beta=beta)
            self.fc2=nn.Linear(hidden,hidden//2)
            self.lif2=snn.Leaky(beta=beta)
            self.fc3=nn.Linear(hidden//2,outputs)
            self.lif3=snn.Leaky(beta=beta,output=True)
        def forward(self,sequence):
            mem1=self.lif1.init_leaky(); mem2=self.lif2.init_leaky(); mem3=self.lif3.init_leaky()
            spikes=[]; membranes=[]
            for step in sequence:
                cur1=self.fc1(step); spk1,mem1=self.lif1(cur1,mem1)
                cur2=self.fc2(spk1); spk2,mem2=self.lif2(cur2,mem2)
                cur3=self.fc3(spk2); spk3,mem3=self.lif3(cur3,mem3)
                spikes.append(spk3); membranes.append(mem3)
            return torch.stack(spikes),torch.stack(membranes)
except Exception:
    SNN_AVAILABLE=False
    RiskSNN=None
